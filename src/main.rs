mod config;
mod handlers;
mod models;
mod repository;
mod tool_parser;
mod upstream_client;

use axum::{
    routing::{get, post},
    Extension, Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();

    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    let config = config::Config::from_file("config.toml")?;

    let repo = Arc::new(
        repository::SessionRepository::new(&config.database.url, config.database.max_connections)
            .await?,
    );

    let ds_client = Arc::new(upstream_client::UpstreamDsFreeClient::new(
        config.upstream.ds_free_api_url,
        config.upstream.timeout_secs,
    ));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/v1/chat/completions", post(handlers::chat_completions_handler))
        .route("/v1/responses", post(handlers::responses_handler))
        .route("/v1/messages", post(handlers::messages_handler))
        .route("/health", get(|| async { "OK" }))
        .layer(Extension(repo))
        .layer(Extension(ds_client))
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = config.server.addr.parse()?;
    info!("Starting server on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
