//! `hhk files` subcommands — manage embedded resource files in a `.hhk` project.
//!
//! ## Commands
//! | Subcommand | Description |
//! |---|---|
//! | `import` | Copy a local file into the project at a virtual path |
//! | `export` | Extract an embedded file back to the local filesystem |
//! | `list`   | List files (optionally filtered by directory) |
//! | `rm`     | Remove a file from the project |
//! | `mv`     | Rename / move a file to a new virtual path |
//! | `info`   | Show metadata for a specific file |

use anyhow::{bail, Result};
use kernel_core::project::file_store::{FileEntry, normalize_path};
use kernel_core::storage::{deserialize_project, serialize_project};
use std::fs;
use std::path::Path;

// ── import ────────────────────────────────────────────────────────────────────

/// Import a local binary file into the project at `vfs_path`.
///
/// # Example
/// ```
/// hhk files import project.hhk ./logo.png /assets/images/logo.png
/// ```
pub fn import(project_path: String, local_file: String, vfs_path: String) -> Result<()> {
    let bytes = fs::read(&project_path)?;
    let mut project = deserialize_project(&bytes)?;

    let data = fs::read(&local_file)
        .map_err(|e| anyhow::anyhow!("Cannot read '{}': {}", local_file, e))?;

    let ext = Path::new(&local_file)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let mime = FileEntry::mime_from_extension(ext).to_string();

    let file_size = data.len();
    let id = project.add_file_at(&vfs_path, &mime, data);

    let out = serialize_project(&project)?;
    fs::write(&project_path, &out)?;

    println!(
        "✓ Imported '{}' → '{}'\n  id: {}\n  mime: {}\n  size: {} bytes",
        local_file,
        normalize_path(&vfs_path),
        id,
        mime,
        file_size,
    );
    Ok(())
}

// ── export ────────────────────────────────────────────────────────────────────

/// Extract an embedded file from the project to a local path.
///
/// # Example
/// ```
/// hhk files export project.hhk /assets/images/logo.png ./logo_extracted.png
/// ```
pub fn export(project_path: String, vfs_path: String, local_output: String) -> Result<()> {
    let bytes = fs::read(&project_path)?;
    let project = deserialize_project(&bytes)?;

    let entry = project
        .find_file_by_path(&vfs_path)
        .ok_or_else(|| anyhow::anyhow!("File '{}' not found in project", vfs_path))?;

    // Create parent directories if needed
    if let Some(parent) = Path::new(&local_output).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    fs::write(&local_output, &entry.data)?;

    println!(
        "✓ Exported '{}' → '{}'\n  size: {} bytes",
        normalize_path(&vfs_path),
        local_output,
        entry.size,
    );
    Ok(())
}

// ── list ──────────────────────────────────────────────────────────────────────

/// List files in the project, optionally filtered to a virtual directory.
///
/// Prints a tree-style view.
pub fn list(project_path: String, dir: Option<String>, recursive: bool) -> Result<()> {
    let bytes = fs::read(&project_path)?;
    let project = deserialize_project(&bytes)?;

    let filter_dir = dir.as_deref().unwrap_or("/");
    // Default to recursive when no --dir specified (show everything)
    let is_recursive = recursive || dir.is_none();

    let entries = if is_recursive {
        project.list_files_under(filter_dir)
    } else {
        project.list_files_in_dir(filter_dir)
    };

    let total_files = project.files.len();
    println!("Files in '{}' (project: {}, {} total embedded):", project_path, project.name, total_files);

    if entries.is_empty() {
        println!("  (no files under '{}')", normalize_path(filter_dir));
        return Ok(());
    }

    println!();
    for entry in &entries {
        println!(
            "  {:<50} {:>10}  {}",
            entry.path,
            fmt_size(entry.size),
            entry.mime_type,
        );
    }
    println!("\n  {} file(s)", entries.len());
    Ok(())
}

// ── rm ────────────────────────────────────────────────────────────────────────

/// Remove an embedded file by its virtual path.
pub fn rm(project_path: String, vfs_path: String) -> Result<()> {
    let bytes = fs::read(&project_path)?;
    let mut project = deserialize_project(&bytes)?;

    let removed = project.remove_file_by_path(&vfs_path)
        .ok_or_else(|| anyhow::anyhow!("File '{}' not found in project", vfs_path))?;

    let out = serialize_project(&project)?;
    fs::write(&project_path, &out)?;

    println!("✓ Removed '{}' ({} bytes) from '{}'",
        removed.path, removed.size, project_path);
    Ok(())
}

// ── mv ────────────────────────────────────────────────────────────────────────

/// Move / rename an embedded file to a new virtual path.
pub fn mv(project_path: String, old_path: String, new_path: String) -> Result<()> {
    let bytes = fs::read(&project_path)?;
    let mut project = deserialize_project(&bytes)?;

    // Find the entry by old path
    let id = project
        .find_file_by_path(&old_path)
        .ok_or_else(|| anyhow::anyhow!("File '{}' not found in project", old_path))?
        .id
        .clone();

    let new_norm = normalize_path(&new_path);

    // Check new path isn't already occupied
    if project.find_file_by_path(&new_norm).is_some() {
        bail!("A file already exists at '{}'. Remove it first.", new_norm);
    }

    project.move_file(&id, &new_norm);

    let out = serialize_project(&project)?;
    fs::write(&project_path, &out)?;

    println!("✓ Moved '{}' → '{}'",
        normalize_path(&old_path), new_norm);
    Ok(())
}

// ── info ──────────────────────────────────────────────────────────────────────

/// Show metadata for an embedded file.
pub fn info(project_path: String, vfs_path: String) -> Result<()> {
    let bytes = fs::read(&project_path)?;
    let project = deserialize_project(&bytes)?;

    let entry = project
        .find_file_by_path(&vfs_path)
        .ok_or_else(|| anyhow::anyhow!("File '{}' not found in project", vfs_path))?;

    println!("File: {}", entry.path);
    println!("  id:         {}", entry.id);
    println!("  name:       {}", entry.name);
    println!("  mime:       {}", entry.mime_type);
    println!("  size:       {} bytes ({})", entry.size, fmt_size(entry.size));
    println!("  created_at: {}", entry.created_at);
    Ok(())
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn fmt_size(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.1} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}
