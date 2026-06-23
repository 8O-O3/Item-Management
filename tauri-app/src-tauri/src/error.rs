use std::fmt;

#[derive(Debug)]
pub enum AppError {
    Db(rusqlite::Error),
    Json(serde_json::Error),
    Io(std::io::Error),
    HttpClient(String),
    Other(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Db(e) => write!(f, "Database error: {}", e),
            AppError::Json(e) => write!(f, "JSON error: {}", e),
            AppError::Io(e) => write!(f, "IO error: {}", e),
            AppError::HttpClient(e) => write!(f, "HTTP error: {}", e),
            AppError::Other(e) => write!(f, "{}", e),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Db(e)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Json(e)
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e)
    }
}

impl From<ureq::Error> for AppError {
    fn from(e: ureq::Error) -> Self {
        AppError::HttpClient(e.to_string())
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(e: zip::result::ZipError) -> Self {
        AppError::Other(e.to_string())
    }
}

impl From<base64::DecodeError> for AppError {
    fn from(e: base64::DecodeError) -> Self {
        AppError::Other(e.to_string())
    }
}

impl From<String> for AppError {
    fn from(e: String) -> Self {
        AppError::Other(e)
    }
}

impl From<&str> for AppError {
    fn from(e: &str) -> Self {
        AppError::Other(e.to_string())
    }
}

impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        e.to_string()
    }
}
