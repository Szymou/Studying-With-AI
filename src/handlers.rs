use crate::models::{
    ChatCompletionRequest, ChatCompletionResponse, Choice, Delta, Message, MessagesRequest,
    MessagesResponse, SSEChunk, SSEChoice, ToolCall,
};
use crate::repository::SessionRepository;
use crate::tool_parser::ToolParser;
use crate::upstream_client::UpstreamDsFreeClient;
use anyhow::Result;
use axum::{
    extract::{Extension, Json, Path},
    response::{sse::Event, Sse},
};
use futures::stream::{self, Stream};
use std::convert::Infallible;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{error, info, warn};
use uuid::Uuid;

pub async fn chat_completions_handler(
    Extension(repo): Extension<Arc<SessionRepository>>,
    Extension(ds_client): Extension<Arc<UpstreamDsFreeClient>>,
    Json(request): Json<ChatCompletionRequest>,
) -> Result<Json<ChatCompletionResponse>, axum::http::StatusCode> {
    info!(
        model = %request.model,
        stream = %request.stream,
        messages_count = %request.messages.len(),
        "Received chat completion request"
    );

    let session_id = if let Some(user) = &request.user {
        match repo
            .create_session(user, &request.model, request.metadata.clone())
            .await
        {
            Ok(id) => id,
            Err(e) => {
                error!(error = %e, "Failed to create session");
                return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    } else {
        Uuid::new_v4().to_string()
    };

    for msg in &request.messages {
        if let Err(e) = repo
            .add_message(
                &session_id,
                &msg.role,
                msg.content.as_deref(),
                None,
                msg.tool_call_id.as_deref(),
                msg.name.as_deref(),
            )
            .await
        {
            error!(error = %e, "Failed to store message");
        }
    }

    let last_user_message = request
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .and_then(|m| m.content.clone())
        .unwrap_or_default();

    let ds_request = crate::models::DsFreeRequest {
        query: last_user_message,
        context: None,
        max_tokens: request.max_tokens.map(|t| t as u32),
        temperature: request.temperature,
    };

    let ds_response = match ds_client.generate(ds_request).await {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "ds-free API call failed");
            return Err(axum::http::StatusCode::BAD_GATEWAY);
        }
    };

    let assistant_message = Message {
        role: "assistant".to_string(),
        content: Some(ds_response.answer.clone()),
        name: None,
        tool_calls: None,
        tool_call_id: None,
    };

    if let Err(e) = repo
        .add_message(&session_id, "assistant", Some(&ds_response.answer), None, None, None)
        .await
    {
        error!(error = %e, "Failed to store assistant message");
    }

    let response = ChatCompletionResponse {
        id: Uuid::new_v4().to_string(),
        object: "chat.completion".to_string(),
        created: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        model: request.model,
        choices: vec![Choice {
            index: 0,
            message: assistant_message,
            finish_reason: Some("stop".to_string()),
        }],
        usage: None,
    };

    Ok(Json(response))
}

pub async fn responses_handler(
    Extension(repo): Extension<Arc<SessionRepository>>,
    Extension(ds_client): Extension<Arc<UpstreamDsFreeClient>>,
    Json(request): Json<ChatCompletionRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, axum::http::StatusCode> {
    info!(
        model = %request.model,
        messages_count = %request.messages.len(),
        "Received responses streaming request"
    );

    let session_id = if let Some(user) = &request.user {
        match repo
            .create_session(user, &request.model, request.metadata.clone())
            .await
        {
            Ok(id) => id,
            Err(e) => {
                error!(error = %e, "Failed to create session");
                return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    } else {
        Uuid::new_v4().to_string()
    };

    for msg in &request.messages {
        let _ = repo
            .add_message(
                &session_id,
                &msg.role,
                msg.content.as_deref(),
                None,
                msg.tool_call_id.as_deref(),
                msg.name.as_deref(),
            )
            .await;
    }

    let last_user_message = request
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .and_then(|m| m.content.clone())
        .unwrap_or_default();

    let ds_request = crate::models::DsFreeRequest {
        query: last_user_message,
        context: None,
        max_tokens: request.max_tokens.map(|t| t as u32),
        temperature: request.temperature,
    };

    let ds_response = match ds_client.generate(ds_request).await {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "ds-free API call failed");
            return Err(axum::http::StatusCode::BAD_GATEWAY);
        }
    };

    let _ = repo
        .add_message(&session_id, "assistant", Some(&ds_response.answer), None, None, None)
        .await;

    let stream = stream::unfold(Some(ds_response.answer), |state| async move {
        if let Some(answer) = state {
            let chunk_id = Uuid::new_v4().to_string();
            let created = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            let delta = Delta {
                role: Some("assistant".to_string()),
                content: Some(answer.clone()),
                tool_calls: None,
            };
            let sse_chunk = SSEChunk {
                id: chunk_id,
                object: "chat.completion.chunk".to_string(),
                created,
                model: request.model.clone(),
                choices: vec![SSEChoice {
                    delta,
                    index: 0,
                    finish_reason: None,
                }],
            };
            let event = Event::default().data(serde_json::to_string(&sse_chunk).unwrap());
            Some((Ok(event), None))
        } else {
            let event = Event::default().data("[DONE]");
            Some((Ok(event), None))
        }
    });

    Ok(Sse::new(stream))
}

pub async fn messages_handler(
    Extension(repo): Extension<Arc<SessionRepository>>,
    Extension(ds_client): Extension<Arc<UpstreamDsFreeClient>>,
    Json(request): Json<MessagesRequest>,
) -> Result<Json<MessagesResponse>, axum::http::StatusCode> {
    info!(
        model = %request.model,
        messages_count = %request.messages.len(),
        "Received messages request"
    );

    let session_id = Uuid::new_v4().to_string();
    let _ = repo
        .create_session("anonymous", &request.model, None)
        .await;

    for msg in &request.messages {
        let content_str = match &msg.content {
            crate::models::AnthropicContent::Text(t) => Some(t.as_str()),
            crate::models::AnthropicContent::Array(blocks) => {
                let texts: Vec<String> = blocks
                    .iter()
                    .filter_map(|b| match b {
                        crate::models::AnthropicContentBlock::Text { text } => Some(text.clone()),
                        _ => None,
                    })
                    .collect();
                if texts.is_empty() {
                    None
                } else {
                    Some(texts.join(" "))
                }
            }
        };
        let _ = repo
            .add_message(&session_id, &msg.role, content_str, None, None, None)
            .await;
    }

    let last_user_content = request
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .and_then(|m| match &m.content {
            crate::models::AnthropicContent::Text(t) => Some(t.clone()),
            crate::models::AnthropicContent::Array(blocks) => {
                let texts: Vec<String> = blocks
                    .iter()
                    .filter_map(|b| match b {
                        crate::models::AnthropicContentBlock::Text { text } => Some(text.clone()),
                        _ => None,
                    })
                    .collect();
                if texts.is_empty() {
                    None
                } else {
                    Some(texts.join(" "))
                }
            }
        })
        .unwrap_or_default();

    let ds_request = crate::models::DsFreeRequest {
        query: last_user_content,
        context: None,
        max_tokens: Some(request.max_tokens),
        temperature: request.temperature,
    };

    let ds_response = match ds_client.generate(ds_request).await {
        Ok(r) => r,
        Err(e) => {
            error!(error = %e, "ds-free API call failed");
            return Err(axum::http::StatusCode::BAD_GATEWAY);
        }
    };

    let _ = repo
        .add_message(&session_id, "assistant", Some(&ds_response.answer), None, None, None)
        .await;

    let response = MessagesResponse {
        id: Uuid::new_v4().to_string(),
        r#type: "message".to_string(),
        role: "assistant".to_string(),
        content: vec![crate::models::AnthropicContentBlock::Text {
            text: ds_response.answer.clone(),
        }],
        model: request.model,
        stop_reason: Some("end_turn".to_string()),
        usage: crate::models::AnthropicUsage {
            input_tokens: 0,
            output_tokens: ds_response.tokens_used,
        },
    };

    Ok(Json(response))
}
