use crate::models::{Message, ToolCall};
use anyhow::Result;
use chrono::Utc;
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, Transaction};
use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct SessionRepository {
    pool: Pool<Sqlite>,
}

impl SessionRepository {
    pub async fn new(database_url: &str, max_connections: u32) -> Result<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(max_connections)
            .connect(database_url)
            .await?;
        sqlx::migrate!().run(&pool).await?;
        info!("Database migrations completed");
        Ok(Self { pool })
    }

    pub fn pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }

    pub async fn create_session(
        &self,
        user_id: &str,
        model: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<String> {
        let session_id = Uuid::new_v4().to_string();
        let metadata_json = metadata.map(|m| m.to_string());
        sqlx::query!(
            r#"INSERT INTO sessions (id, user_id, model, metadata) VALUES (?, ?, ?, ?)"#,
            session_id,
            user_id,
            model,
            metadata_json
        )
        .execute(&self.pool)
        .await?;
        info!(session_id = %session_id, user_id = %user_id, "Session created");
        Ok(session_id)
    }

    pub async fn add_message(
        &self,
        session_id: &str,
        role: &str,
        content: Option<&str>,
        tool_calls: Option<&Vec<ToolCall>>,
        tool_call_id: Option<&str>,
        name: Option<&str>,
    ) -> Result<i64> {
        let tool_calls_json = tool_calls.map(|tc| serde_json::to_string(tc).unwrap());
        let result = sqlx::query!(
            r#"INSERT INTO messages (session_id, role, content, tool_calls, tool_call_id, name)
               VALUES (?, ?, ?, ?, ?, ?)"#,
            session_id,
            role,
            content,
            tool_calls_json,
            tool_call_id,
            name
        )
        .execute(&self.pool)
        .await?;
        let message_id = result.last_insert_rowid();
        self.update_session_updated_at(session_id).await?;
        Ok(message_id)
    }

    async fn update_session_updated_at(&self, session_id: &str) -> Result<()> {
        sqlx::query!(
            "UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            session_id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn get_session_messages(&self, session_id: &str) -> Result<Vec<Message>> {
        let rows = sqlx::query!(
            r#"SELECT role, content, tool_calls, tool_call_id, name
               FROM messages
               WHERE session_id = ?
               ORDER BY created_at ASC"#,
            session_id
        )
        .fetch_all(&self.pool)
        .await?;
        let mut messages = Vec::new();
        for row in rows {
            let tool_calls = row
                .tool_calls
                .as_ref()
                .and_then(|json| serde_json::from_str(json).ok());
            messages.push(Message {
                role: row.role,
                content: row.content,
                name: row.name,
                tool_calls,
                tool_call_id: row.tool_call_id,
            });
        }
        Ok(messages)
    }

    pub async fn log_tool_call(
        &self,
        session_id: &str,
        tool_call_id: &str,
        tool_name: &str,
        arguments: &serde_json::Value,
    ) -> Result<()> {
        let args_str = arguments.to_string();
        sqlx::query!(
            r#"INSERT INTO tool_calls_log (session_id, tool_call_id, tool_name, arguments, status)
               VALUES (?, ?, ?, ?, 'pending')"#,
            session_id,
            tool_call_id,
            tool_name,
            args_str
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn complete_tool_call(
        &self,
        tool_call_id: &str,
        result: &str,
        error: Option<&str>,
    ) -> Result<()> {
        let status = if error.is_some() { "error" } else { "completed" };
        let result_str = if error.is_some() { None } else { Some(result) };
        let error_str = error.map(|e| e.to_string());
        sqlx::query!(
            r#"UPDATE tool_calls_log
               SET status = ?, result = ?, error = ?, completed_at = CURRENT_TIMESTAMP
               WHERE tool_call_id = ?"#,
            status,
            result_str,
            error_str,
            tool_call_id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn begin_transaction(&self) -> Result<Transaction<'_, Sqlite>> {
        Ok(self.pool.begin().await?)
    }
}
