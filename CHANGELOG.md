# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Optional Cloud Backend powered by Supabase and MailerLite for cross-device synchronization and collaboration.
- Local-first document storage and vector search using BGE embeddings.
- Offline generative AI answers via Ollama/Phi-3.
- Complete desktop app infrastructure using Electron.
- Secure local authentication (bcrypt) out of the box without requiring internet.
- Initial mesh network experiments for LAN sharing.

### Changed
- Standardized the Electron IPC communication layer.
- Upgraded the React UI stack to integrate with local AI services seamlessly.

### Fixed
- Stabilized the local SQLite storage driver for high-throughput note taking.
