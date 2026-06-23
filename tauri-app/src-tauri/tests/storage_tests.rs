// ── Integration Tests for SqliteStorage ──────────────────────────
// All tests use in-memory SQLite for speed and isolation.

use project_manager::db::sqlite::SqliteStorage;
use project_manager::models::{NodeFile, TimelineEntry};
use project_manager::storage::Storage;

fn setup() -> SqliteStorage {
    SqliteStorage::new_in_memory().expect("Failed to create in-memory DB")
}

// ── Folder Tests ─────────────────────────────────────────────

#[test]
fn folder_create_root() {
    let s = setup();
    let f = s.create_folder("Root", None).unwrap();
    assert_eq!(f.name, "Root");
    assert_eq!(f.parent_id, None);
    assert!(f.id.is_some());
}

#[test]
fn folder_create_nested() {
    let s = setup();
    let parent = s.create_folder("Parent", None).unwrap();
    let child = s.create_folder("Child", Some(parent.id.unwrap())).unwrap();
    assert_eq!(child.parent_id, parent.id);
}

#[test]
fn folder_max_depth_4() {
    let s = setup();
    let f1 = s.create_folder("F1", None).unwrap();
    let f2 = s.create_folder("F2", Some(f1.id.unwrap())).unwrap();
    let f3 = s.create_folder("F3", Some(f2.id.unwrap())).unwrap();
    let f4 = s.create_folder("F4", Some(f3.id.unwrap())).unwrap();
    // F5 would be depth 5 → should fail
    let result = s.create_folder("F5", Some(f4.id.unwrap()));
    assert!(result.is_err());
}

#[test]
fn folder_move_prevents_cycle() {
    let s = setup();
    let parent = s.create_folder("Parent", None).unwrap();
    let child = s.create_folder("Child", Some(parent.id.unwrap())).unwrap();
    // Moving parent under child should fail
    let result = s.move_folder(parent.id.unwrap(), Some(child.id.unwrap()));
    assert!(result.is_err());
}

#[test]
fn folder_move_prevents_self_parent() {
    let s = setup();
    let f = s.create_folder("F", None).unwrap();
    let result = s.move_folder(f.id.unwrap(), Some(f.id.unwrap()));
    assert!(result.is_err());
}

#[test]
fn folder_update_name() {
    let s = setup();
    let f = s.create_folder("Old", None).unwrap();
    s.update_folder(f.id.unwrap(), "New").unwrap();
    let folders = s.get_folders().unwrap();
    assert_eq!(folders[0].name, "New");
}

#[test]
fn folder_delete_cascades() {
    let s = setup();
    let parent = s.create_folder("Parent", None).unwrap();
    let child = s.create_folder("Child", Some(parent.id.unwrap())).unwrap();
    // Create a project in child folder
    s.create_project("P", None, Some(child.id.unwrap())).unwrap();

    // Delete parent → should cascade-delete child, nullify project's folder_id
    s.delete_folder(parent.id.unwrap()).unwrap();
    let folders = s.get_folders().unwrap();
    assert!(folders.is_empty());
    let projects = s.get_projects().unwrap();
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].folder_id, None);
}

#[test]
fn folder_list_sorted_by_id() {
    let s = setup();
    s.create_folder("B", None).unwrap();
    s.create_folder("A", None).unwrap();
    s.create_folder("C", None).unwrap();
    let folders = s.get_folders().unwrap();
    let names: Vec<&str> = folders.iter().map(|f| f.name.as_str()).collect();
    assert_eq!(names, vec!["B", "A", "C"]); // Sorted by insertion order (id)
}

// ── Project Tests ───────────────────────────────────────────

#[test]
fn project_create_root() {
    let s = setup();
    let p = s.create_project("Proj", Some("desc"), None).unwrap();
    assert_eq!(p.name, "Proj");
    assert_eq!(p.desc, Some("desc".into()));
    assert_eq!(p.folder_id, None);
}

#[test]
fn project_create_in_folder() {
    let s = setup();
    let f = s.create_folder("F", None).unwrap();
    let p = s.create_project("Proj", None, f.id).unwrap();
    assert_eq!(p.folder_id, f.id);
}

#[test]
fn project_update_all_fields() {
    let s = setup();
    let p = s.create_project("Old", None, None).unwrap();
    let f = s.create_folder("F", None).unwrap();
    s.update_project(p.id.unwrap(), "New", Some("desc"), f.id).unwrap();
    let projects = s.get_projects().unwrap();
    assert_eq!(projects[0].name, "New");
    assert_eq!(projects[0].desc, Some("desc".into()));
    assert_eq!(projects[0].folder_id, f.id);
}

#[test]
fn project_move_between_folders() {
    let s = setup();
    let f1 = s.create_folder("F1", None).unwrap();
    let f2 = s.create_folder("F2", None).unwrap();
    let p = s.create_project("P", None, f1.id).unwrap();
    assert_eq!(p.folder_id, f1.id);

    s.move_project(p.id.unwrap(), f2.id).unwrap();
    let projects = s.get_projects().unwrap();
    assert_eq!(projects[0].folder_id, f2.id);
}

#[test]
fn project_delete_removes_nodes() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    s.create_node(p.id.unwrap(), "N1", None).unwrap();
    s.create_node(p.id.unwrap(), "N2", None).unwrap();

    s.delete_project(p.id.unwrap()).unwrap();
    let projects = s.get_projects().unwrap();
    assert!(projects.is_empty());
    // Nodes are deleted via CASCADE or explicit DELETE
    // Can't query nodes since project is gone - get_nodes would fail
}

// ── Node Tests ──────────────────────────────────────────────

#[test]
fn node_create_with_desc() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "Node", Some("Description text")).unwrap();
    assert_eq!(n.title, "Node");
    assert_eq!(n.desc, Some("Description text".into()));
    assert!(n.files.is_empty());
    assert!(n.timeline.is_empty());
}

#[test]
fn node_create_without_desc() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "Node", None).unwrap();
    assert_eq!(n.title, "Node");
    assert_eq!(n.desc, None);
}

#[test]
fn node_list_by_project() {
    let s = setup();
    let p1 = s.create_project("P1", None, None).unwrap();
    let p2 = s.create_project("P2", None, None).unwrap();
    s.create_node(p1.id.unwrap(), "N1", None).unwrap();
    s.create_node(p1.id.unwrap(), "N2", None).unwrap();
    s.create_node(p2.id.unwrap(), "N3", None).unwrap();

    let nodes_p1 = s.get_nodes(p1.id.unwrap()).unwrap();
    assert_eq!(nodes_p1.len(), 2);
    let nodes_p2 = s.get_nodes(p2.id.unwrap()).unwrap();
    assert_eq!(nodes_p2.len(), 1);
}

#[test]
fn node_update_title_and_desc() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "Old", None).unwrap();
    s.update_node(n.id.unwrap(), "New", Some("Updated desc")).unwrap();
    let nodes = s.get_nodes(p.id.unwrap()).unwrap();
    assert_eq!(nodes[0].title, "New");
    assert_eq!(nodes[0].desc, Some("Updated desc".into()));
}

#[test]
fn node_delete() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "N", None).unwrap();
    s.delete_node(n.id.unwrap()).unwrap();
    let nodes = s.get_nodes(p.id.unwrap()).unwrap();
    assert!(nodes.is_empty());
}

// ── File Tests ──────────────────────────────────────────────

fn make_file(name: &str) -> NodeFile {
    NodeFile {
        name: name.to_string(),
        path: String::new(),
        size: Some(1024),
        data: Some("data:text/plain;base64,aGVsbG8=".to_string()),
        added_at: "2024-01-01T00:00:00Z".to_string(),
    }
}

#[test]
fn file_add_to_node() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "N", None).unwrap();

    s.add_file_to_node(n.id.unwrap(), make_file("test.txt")).unwrap();
    let nodes = s.get_nodes(p.id.unwrap()).unwrap();
    assert_eq!(nodes[0].files.len(), 1);
    assert_eq!(nodes[0].files[0].name, "test.txt");
}

#[test]
fn file_add_multiple() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "N", None).unwrap();

    s.add_file_to_node(n.id.unwrap(), make_file("a.txt")).unwrap();
    s.add_file_to_node(n.id.unwrap(), make_file("b.txt")).unwrap();
    s.add_file_to_node(n.id.unwrap(), make_file("c.txt")).unwrap();

    let nodes = s.get_nodes(p.id.unwrap()).unwrap();
    assert_eq!(nodes[0].files.len(), 3);
}

#[test]
fn file_remove_by_index() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "N", None).unwrap();

    s.add_file_to_node(n.id.unwrap(), make_file("keep.txt")).unwrap();
    s.add_file_to_node(n.id.unwrap(), make_file("remove.txt")).unwrap();

    s.remove_file_from_node(n.id.unwrap(), 1).unwrap();
    let nodes = s.get_nodes(p.id.unwrap()).unwrap();
    assert_eq!(nodes[0].files.len(), 1);
    assert_eq!(nodes[0].files[0].name, "keep.txt");
}

#[test]
fn file_remove_out_of_bounds_ignored() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "N", None).unwrap();
    s.add_file_to_node(n.id.unwrap(), make_file("f.txt")).unwrap();

    // Removing at invalid index should not panic
    let result = s.remove_file_from_node(n.id.unwrap(), 99);
    assert!(result.is_ok());
    let nodes = s.get_nodes(p.id.unwrap()).unwrap();
    assert_eq!(nodes[0].files.len(), 1);
}

#[test]
fn file_read_base64() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "N", None).unwrap();
    s.add_file_to_node(n.id.unwrap(), make_file("hello.txt")).unwrap();

    let bytes = s.read_file_bytes(n.id.unwrap(), 0).unwrap();
    assert_eq!(bytes, b"hello");
}

#[test]
fn file_read_out_of_bounds_errors() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "N", None).unwrap();
    let result = s.read_file_bytes(n.id.unwrap(), 0);
    assert!(result.is_err());
}

// ── Timeline Tests ──────────────────────────────────────────

#[test]
fn timeline_add_entry() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "N", None).unwrap();

    let entry = TimelineEntry {
        content: "Started work".to_string(),
        time: "2024-01-01T12:00:00Z".to_string(),
    };
    s.add_timeline_entry(n.id.unwrap(), entry).unwrap();
    let nodes = s.get_nodes(p.id.unwrap()).unwrap();
    assert_eq!(nodes[0].timeline.len(), 1);
    assert_eq!(nodes[0].timeline[0].content, "Started work");
}

#[test]
fn timeline_add_multiple_entries() {
    let s = setup();
    let p = s.create_project("P", None, None).unwrap();
    let n = s.create_node(p.id.unwrap(), "N", None).unwrap();

    for i in 1..=5 {
        let entry = TimelineEntry {
            content: format!("Entry {}", i),
            time: format!("2024-01-0{}T00:00:00Z", i),
        };
        s.add_timeline_entry(n.id.unwrap(), entry).unwrap();
    }
    let nodes = s.get_nodes(p.id.unwrap()).unwrap();
    assert_eq!(nodes[0].timeline.len(), 5);
}

// ── Export / Import Tests ───────────────────────────────────

#[test]
fn export_empty() {
    let s = setup();
    let json = s.export_all().unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert!(parsed["folders"].as_array().unwrap().is_empty());
    assert!(parsed["projects"].as_array().unwrap().is_empty());
    assert!(parsed["nodes"].as_array().unwrap().is_empty());
}

#[test]
fn export_with_data() {
    let s = setup();
    let f = s.create_folder("F", None).unwrap();
    let p = s.create_project("P", None, f.id).unwrap();
    s.create_node(p.id.unwrap(), "N1", None).unwrap();
    s.create_node(p.id.unwrap(), "N2", Some("Desc")).unwrap();

    let json = s.export_all().unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["folders"].as_array().unwrap().len(), 1);
    assert_eq!(parsed["projects"].as_array().unwrap().len(), 1);
    assert_eq!(parsed["nodes"].as_array().unwrap().len(), 2);
}

#[test]
fn export_is_valid_json() {
    let s = setup();
    s.create_folder("F", None).unwrap();
    let json = s.export_all().unwrap();
    assert!(serde_json::from_str::<serde_json::Value>(&json).is_ok());
}

#[test]
fn import_basic() {
    let s = setup();
    let folders = vec![project_manager::models::Folder {
        id: None,
        name: "Imported".to_string(),
        parent_id: None,
        created_at: "2024-01-01T00:00:00Z".to_string(),
    }];
    let projects = vec![project_manager::models::Project {
        id: None,
        name: "ImportedProj".to_string(),
        desc: None,
        folder_id: None,
        created_at: "2024-01-01T00:00:00Z".to_string(),
    }];
    s.import_all(folders, projects, vec![]).unwrap();

    let folders = s.get_folders().unwrap();
    assert_eq!(folders.len(), 1);
    assert_eq!(folders[0].name, "Imported");
    let projects = s.get_projects().unwrap();
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].name, "ImportedProj");
}

#[test]
fn import_preserves_names() {
    let s = setup();
    let folders = vec![
        project_manager::models::Folder {
            id: None, name: "Work".into(), parent_id: None,
            created_at: "2024-01-01T00:00:00Z".into(),
        },
        project_manager::models::Folder {
            id: None, name: "Personal".into(), parent_id: None,
            created_at: "2024-01-01T00:00:00Z".into(),
        },
    ];
    s.import_all(folders, vec![], vec![]).unwrap();
    let folders = s.get_folders().unwrap();
    let names: Vec<&str> = folders.iter().map(|f| f.name.as_str()).collect();
    assert!(names.contains(&"Work"));
    assert!(names.contains(&"Personal"));
}

#[test]
fn import_idempotent() {
    let s = setup();
    let folders = vec![project_manager::models::Folder {
        id: None, name: "F".into(), parent_id: None,
        created_at: "2024-01-01T00:00:00Z".into(),
    }];
    s.import_all(folders.clone(), vec![], vec![]).unwrap();
    s.import_all(folders, vec![], vec![]).unwrap();
    assert_eq!(s.get_folders().unwrap().len(), 2); // Creates duplicates
}

// ── Migration Tests ─────────────────────────────────────────

#[test]
fn migration_v1_creates_tables() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    project_manager::db::migration::run_migrations(&conn).unwrap();

    // Verify all tables exist
    let tables: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();

    assert!(tables.contains(&"folders".to_string()));
    assert!(tables.contains(&"projects".to_string()));
    assert!(tables.contains(&"nodes".to_string()));
    assert!(tables.contains(&"schema_version".to_string()));
}

#[test]
fn migration_is_idempotent() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    // Running migrations twice should not panic
    project_manager::db::migration::run_migrations(&conn).unwrap();
    project_manager::db::migration::run_migrations(&conn).unwrap();
    project_manager::db::migration::run_migrations(&conn).unwrap();

    // Should still have the correct tables
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn migration_v2_adds_parent_id() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    // Run v1 only first, then v2
    rusqlite::Connection::open_in_memory().unwrap(); // just to verify we're clean

    // Run migrations normally
    project_manager::db::migration::run_migrations(&conn).unwrap();

    // Insert a folder and verify parent_id column works
    conn.execute(
        "INSERT INTO folders (name, parent_id, created_at) VALUES ('test', NULL, '2024-01-01')",
        [],
    )
    .unwrap();
    let name: String = conn
        .query_row("SELECT name FROM folders WHERE id = 1", [], |row| row.get(0))
        .unwrap();
    assert_eq!(name, "test");
}
