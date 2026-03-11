fn main() {
    // Generate Rust code from proto files.
    // Note: protoc must be installed and in PATH.
    // Install: https://grpc.io/docs/protoc-installation/
    //
    // If protoc is not available, the generated stubs in src/generated/ are used.
    let proto_dir = "proto";
    let protos = [
        "proto/types.proto",
        "proto/commands.proto",
        "proto/queries.proto",
        "proto/events.proto",
    ];

    // Only run if proto files changed (or generated dir is missing)
    for proto in &protos {
        println!("cargo:rerun-if-changed={}", proto);
    }
    println!("cargo:rerun-if-changed={}", proto_dir);

    // Try to build with prost-build; if protoc is missing, skip gracefully
    match prost_build::Config::new()
        .out_dir("src/generated")
        .compile_protos(&protos, &[proto_dir])
    {
        Ok(_) => println!("cargo:warning=Proto files compiled successfully"),
        Err(e) => {
            println!("cargo:warning=Proto compilation skipped (protoc not found): {}", e);
        }
    }
}

