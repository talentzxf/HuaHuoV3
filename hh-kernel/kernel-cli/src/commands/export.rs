use anyhow::{Result, bail};
use kernel_core::storage::deserialize_project;
use std::fs;
use std::path::Path;

pub fn run(input: String, output: Option<String>, format: String) -> Result<()> {
    let bytes = fs::read(&input)?;
    let project = deserialize_project(&bytes)?;

    let out_path = output.unwrap_or_else(|| {
        let stem = Path::new(&input).file_stem().unwrap_or_default().to_string_lossy();
        format!("{}.{}", stem, if format == "json" { "json" } else { "hhk" })
    });

    match format.as_str() {
        "json" => {
            let json = serde_json::to_string_pretty(&project)?;
            fs::write(&out_path, json.as_bytes())?;
            println!("✓ Exported to JSON: {}", out_path);
        }
        "binary" | "hhk" => {
            let out_bytes = kernel_core::storage::serialize_project(&project)?;
            fs::write(&out_path, &out_bytes)?;
            println!("✓ Exported to binary: {} ({} bytes)", out_path, out_bytes.len());
        }
        f => bail!("Unknown format: {}. Use 'json' or 'binary'", f),
    }

    Ok(())
}

