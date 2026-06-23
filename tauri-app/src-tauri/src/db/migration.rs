use rusqlite::Connection;
use crate::error::AppError;

#[allow(dead_code)]
const CURRENT_VERSION: i64 = 5;

/// Run schema migrations incrementally to reach CURRENT_VERSION.
pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL
        )",
        [],
    )?;

    let version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if version < 1 { migrate_v1(conn)?; }
    if version < 2 { migrate_v2(conn)?; }
    if version < 3 { migrate_v3(conn)?; }
    if version < 4 { migrate_v4(conn)?; }
    if version < 5 { migrate_v5(conn)?; }

    Ok(())
}

fn migrate_v2(conn: &Connection) -> Result<(), AppError> {
    conn.execute(
        "ALTER TABLE folders ADD COLUMN parent_id INTEGER REFERENCES folders(id)",
        [],
    )?;
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (2)",
        [],
    )?;
    Ok(())
}

fn migrate_v3(conn: &Connection) -> Result<(), AppError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS api_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            api_key TEXT NOT NULL,
            base_url TEXT NOT NULL,
            model TEXT NOT NULL,
            system_prompt TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        )",
        [],
    )?;
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (3)",
        [],
    )?;
    Ok(())
}

fn migrate_v4(conn: &Connection) -> Result<(), AppError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            model_config_id INTEGER,
            context_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )",
        [],
    )?;
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (4)",
        [],
    )?;
    Ok(())
}

fn migrate_v5(conn: &Connection) -> Result<(), AppError> {
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(title, desc, content='nodes', content_rowid='id')",
        [],
    )?;
    conn.execute(
        "INSERT INTO nodes_fts(rowid, title, desc) SELECT id, title, desc FROM nodes",
        [],
    )?;
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS nodes_fts_ai AFTER INSERT ON nodes BEGIN
            INSERT INTO nodes_fts(rowid, title, desc) VALUES (new.id, new.title, new.desc);
        END",
        [],
    )?;
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS nodes_fts_ad AFTER DELETE ON nodes BEGIN
            INSERT INTO nodes_fts(nodes_fts, rowid, title, desc) VALUES('delete', old.id, old.title, old.desc);
        END",
        [],
    )?;
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS nodes_fts_au AFTER UPDATE ON nodes BEGIN
            INSERT INTO nodes_fts(nodes_fts, rowid, title, desc) VALUES('delete', old.id, old.title, old.desc);
            INSERT INTO nodes_fts(rowid, title, desc) VALUES (new.id, new.title, new.desc);
        END",
        [],
    )?;
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (5)",
        [],
    )?;
    Ok(())
}

fn migrate_v1(conn: &Connection) -> Result<(), AppError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            desc TEXT,
            folder_id INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (folder_id) REFERENCES folders(id)
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            desc TEXT,
            files TEXT,
            timeline TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )?;
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (1)",
        [],
    )?;
    Ok(())
}
