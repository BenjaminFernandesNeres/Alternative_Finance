-- GeoAlpha / WarSignals PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    api_endpoint VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE commodities (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    asset_class VARCHAR(50)
);

CREATE TABLE normalized_events (
    id VARCHAR(100) PRIMARY KEY,
    provider_id INTEGER REFERENCES providers(id),
    event_timestamp TIMESTAMPTZ NOT NULL,
    ingestion_timestamp TIMESTAMPTZ DEFAULT NOW(),
    event_type VARCHAR(50),
    title TEXT NOT NULL,
    summary TEXT,
    actors JSONB,
    countries JSONB,
    region VARCHAR(100),
    severity_score FLOAT,
    confidence_score FLOAT,
    commodity_tags JSONB,
    duplicate_cluster_id VARCHAR(100)
);
-- Optimize for time-series queries
SELECT create_hypertable('normalized_events', 'event_timestamp');

CREATE TABLE factor_features (
    id SERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    entity_id VARCHAR(100) NOT NULL, -- e.g., 'Strait_of_Hormuz' or 'Russia'
    feature_name VARCHAR(100) NOT NULL,
    value FLOAT NOT NULL,
    PRIMARY KEY (id, timestamp)
);
SELECT create_hypertable('factor_features', 'timestamp');

CREATE TABLE signals (
    id VARCHAR(100) PRIMARY KEY,
    commodity_id INTEGER REFERENCES commodities(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    target_horizon VARCHAR(20),
    direction VARCHAR(20), -- BULLISH, BEARISH, NEUTRAL
    conviction_score FLOAT,
    rationale TEXT
);

CREATE TABLE signal_evidence (
    signal_id VARCHAR(100) REFERENCES signals(id),
    event_id VARCHAR(100) REFERENCES normalized_events(id),
    weight FLOAT DEFAULT 1.0,
    PRIMARY KEY (signal_id, event_id)
);

-- Indexes
CREATE INDEX idx_events_region ON normalized_events(region);
CREATE INDEX idx_features_entity ON factor_features(entity_id, feature_name);
