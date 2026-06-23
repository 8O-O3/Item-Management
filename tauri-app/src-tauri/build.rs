use std::fs;

fn main() {
    // Sync version from Cargo.toml into tauri.conf.json
    // CARGO_PKG_VERSION is set by cargo, e.g. "0.2.0"
    let version = env!("CARGO_PKG_VERSION");

    let conf_path = "tauri.conf.json";
    if let Ok(json) = fs::read_to_string(conf_path) {
        if let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&json) {
            let old = value["version"].as_str().unwrap_or("").to_string();
            if old != version {
                value["version"] = serde_json::Value::String(version.to_string());
                if let Ok(new_json) = serde_json::to_string_pretty(&value) {
                    let _ = fs::write(conf_path, new_json);
                    println!("cargo:warning=Synced tauri.conf.json version: {old} → {version}");
                }
            }
        }
    }

    tauri_build::build()
}
