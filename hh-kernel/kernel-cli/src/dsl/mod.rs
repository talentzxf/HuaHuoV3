//! HuaHuo Script (`.hhs`) — a small domain-specific language for editing
//! `.hhk` animation projects from the command line or CI pipelines.
//!
//! ## Quick syntax reference
//!
//! ```hhs
//! # load / create a project
//! load("my.hhk")                        # load existing file
//! # -- or --
//! project = new_project("My Anim", fps=30, w=800, h=600)
//!
//! # scene & layer management
//! scene   = project.scene("DefaultScene")   # get by name or id
//! scene   = project.new_scene("Cut02", fps=24, duration=10)
//! layer   = scene.new_layer("fx")
//! layer   = scene.layer("drawing")          # get existing
//!
//! # game-object management
//! go = layer.new_go("ball", born=0)
//! go = layer.go("ball")                     # get existing by name/id
//!
//! # add / inspect components
//! go.add_component("Transform")
//! go.add_component("Visual")
//!
//! # set keyframes
//! go.set_kf("Transform", "position", frame=0,  value=vec2(0,300))
//! go.set_kf("Transform", "position", frame=30, value=vec2(400,300), easing="ease-in-out")
//! go.set_kf("Transform", "rotation", frame=0,  value=float(0))
//! go.set_kf("Transform", "rotation", frame=60, value=float(360))
//! go.set_kf("Visual", "fillColor",   frame=0,  value=color(255,0,128,255))
//!
//! # remove a keyframe
//! go.rm_kf("Transform", "position", frame=30)
//!
//! # variable assignment & chaining
//! let go2 = layer.new_go("rect2", born=5)
//! go2.add_component("Transform")
//!    .set_kf("Transform","position",frame=0,value=vec2(100,100))
//!
//! # layer properties
//! layer.set_locked(true)
//! layer.set_visible(false)
//!
//! # interpolate (print result, does not modify file)
//! go.interpolate(frame=15)
//!
//! # save
//! save("output.hhk")           # explicit path
//! save()                        # overwrite loaded file
//! ```

pub mod lexer;
pub mod parser;
pub mod interpreter;

pub use interpreter::Interpreter;

