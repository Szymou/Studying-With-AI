use crate::models::{DsFreeRequest, DsFreeResponse};
use anyhow::{Context, Result};
use reqwest::Client;
use std::time::Duration;
use tracing::{debug, error, info};

#[derive(Debug, Clone)]
pub struct UpstreamDsFreeClient {
    client: Client,
    base_url: String,
    timeout: Duration,
}

impl UpstreamDsFreeClient {
    pub fn new(base_url: String, timeout_secs: u64) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .expect("Failed to create HTTP client");
        Self {
            client,
            base_url,
            timeout: Duration::from_secs(timeout_secs),
        }
    }

    pub async fn generate(&self, request: DsFreeRequest) -> Result<DsFreeResponse> {
        let url = format!("{}/generate", self.base_url);
        debug!(url = %url, "Calling ds-free API");
        let response = self
            .client
            .post(&url)
            .json(&request)
            .timeout(self.timeout)
            .send()
            .await
            .context("Failed to send request to ds-free API")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!(status = %status, error = %error_text, "ds-free API error");
            anyhow::bail!("ds-free API returned {}: {}", status, error_text);
        }

        let ds_response = response
            .json::<DsFreeResponse>()
            .await
            .context("Failed to parse ds-free response")?;
        info!("Received response from ds-free API, tokens_used={}", ds_response.tokens_used);
        Ok(ds_response)
    }
}
