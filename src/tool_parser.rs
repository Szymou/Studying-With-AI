use crate::models::{Function, Tool, ToolCall};
use anyhow::{anyhow, Result};
use serde_json::Value;
use std::collections::HashMap;

pub struct ToolParser;

impl ToolParser {
    pub fn parse_tool_calls(tools: &[Tool], arguments: &str) -> Result<Vec<ToolCall>> {
        let args: Value = serde_json::from_str(arguments)?;
        let mut tool_calls = Vec::new();
        if let Some(tool_calls_array) = args.get("tool_calls").and_then(|v| v.as_array()) {
            for call in tool_calls_array {
                let id = call
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow!("Missing tool call id"))?
                    .to_string();
                let name = call
                    .get("function")
                    .and_then(|f| f.get("name"))
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| anyhow!("Missing function name"))?
                    .to_string();
                let call_args = call
                    .get("function")
                    .and_then(|f| f.get("arguments"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("{}")
                    .to_string();
                tool_calls.push(ToolCall {
                    id,
                    r#type: "function".to_string(),
                    function: crate::models::FunctionCall {
                        name,
                        arguments: call_args,
                    },
                });
            }
        }
        Ok(tool_calls)
    }

    pub fn validate_tool_call(tools: &[Tool], tool_name: &str, arguments: &Value) -> Result<()> {
        let tool = tools
            .iter()
            .find(|t| t.function.name == tool_name)
            .ok_or_else(|| anyhow!("Tool {} not found", tool_name))?;
        if let Some(params) = &tool.function.parameters {
            if let Some(required) = params.get("required").and_then(|v| v.as_array()) {
                for req in required {
                    if let Some(req_str) = req.as_str() {
                        if !arguments.get(req_str).is_some() {
                            anyhow::bail!("Missing required parameter: {}", req_str);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub fn extract_tool_calls_from_response(content: &str) -> Result<Vec<ToolCall>> {
        if content.is_empty() {
            return Ok(Vec::new());
        }
        let parsed: Value = serde_json::from_str(content)?;
        let mut tool_calls = Vec::new();
        if let Some(tc_array) = parsed.get("tool_calls").and_then(|v| v.as_array()) {
            for tc in tc_array {
                let id = tc
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let name = tc
                    .get("function")
                    .and_then(|f| f.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let args = tc
                    .get("function")
                    .and_then(|f| f.get("arguments"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("{}")
                    .to_string();
                tool_calls.push(ToolCall {
                    id,
                    r#type: "function".to_string(),
                    function: crate::models::FunctionCall {
                        name,
                        arguments: args,
                    },
                });
            }
        }
        Ok(tool_calls)
    }
}
