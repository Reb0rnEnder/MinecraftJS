// Port of `client/js/game/command-block.js`

//! Command block functionality port:
//! - CommandBlockScreen and CommandMinecartScreen GUI handling
//! - Command block mode (REDSTONE, AUTO, SEQUENCE)
//! - Command tracking and output handling
//! - Command block command execution and tracking

use serde_json::Value;

/// Mode types for command blocks, mirroring MODES from client/js/gui/screens/commandblock.js
#[derive(Debug, Clone, PartialEq)]
pub enum CommandBlockMode {
    CommandBlock,
    RepeatingCommandBlock,
    ChainCommandBlock,
}

/// Represents a command block with its state and command.
#[derive(Debug, Clone)]
pub struct CommandBlock {
    /// The name/ID of the command block block type
    pub name: String,
    /// The current mode of the command block
    pub mode: CommandBlockMode,
    /// Whether the command block is conditional
    pub conditional: bool,
    /// The command string stored in the command block
    pub command: String,
    /// Whether output tracking is enabled
    pub track_output: bool,
    /// The last output from the command block
    pub last_output: Option<String>,
}

impl CommandBlock {
    /// Create a new command block with default state
    pub fn new(name: String) -> Self {
        CommandBlock {
            name,
            mode: CommandBlockMode::CommandBlock,
            conditional: false,
            command: String::new(),
            track_output: true,
            last_output: None,
        }
    }

    /// Set the command for the command block
    pub fn set_command(&mut self, command: &str) {
        self.command = command.to_string();
    }

    /// Get the command as a string
    pub fn command(&self) -> &str {
        &self.command
    }

    /// Track the output from the command block
    pub fn set_track_output(&mut self, track: bool) {
        self.track_output = track;
    }

    /// Get whether output is being tracked
    pub fn track_output(&self) -> bool {
        self.track_output
    }

    /// Set the last output from the command block
    pub fn set_last_output(&mut self, output: Option<String>) {
        self.last_output = output;
    }

    /// Get the last output from the command block
    pub fn last_output(&self) -> Option<&str> {
        self.last_output.as_deref()
    }

    /// Convert mode to string, mirroring the MODES object from the JS file
    pub fn mode_to_string(&self) -> &'static str {
        match self.mode {
            CommandBlockMode::CommandBlock => "REDSTONE",
            CommandBlockMode::RepeatingCommandBlock => "AUTO",
            CommandBlockMode::ChainCommandBlock => "SEQUENCE",
        }
    }

    /// Parse a command block state from block state properties.
    /// Mirrors the init() method's state reading from CommandBlockScreen.
    pub fn from_state(name: &str, state: &Value) -> Self {
        let mode = if let Some(modes) = Value::Object(state).get("modes") {
            // Simplified: determine mode from block state
            CommandBlockMode::CommandBlock
        } else {
            CommandBlockMode::CommandBlock
        };
        let conditional = state.get("conditional")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        CommandBlock::new(name.to_string())
            .with_mode(mode)
            .with_conditional(conditional)
    }

    /// Set the mode on the command block
    pub fn with_mode(mut self, mode: CommandBlockMode) -> Self {
        self.mode = mode;
        self
    }

    /// Set conditional state on the command block
    pub fn with_conditional(mut self, conditional: bool) -> Self {
        self.conditional = conditional;
        self
    }
}

/// Convert a command block mode string to the enum, mirroring MODES lookup from JS
pub fn mode_from_string(s: &str) -> CommandBlockMode {
    match s {
        "REDSTONE" | "command_block" => CommandBlockMode::CommandBlock,
        "AUTO" | "repeating_command_block" => CommandBlockMode::RepeatingCommandBlock,
        "SEQUENCE" | "chain_command_block" => CommandBlockMode::ChainCommandBlock,
        _ => CommandBlockMode::CommandBlock,
    }
}

/// Serialize a command block to a JSON object suitable for sending to the server.
/// Mirrors the done() method's packet sending from CommandBlockScreen.
pub fn command_block_to_json(cb: &CommandBlock) -> Value {
    serde_json::json!({
        "Command": cb.command,
        "TrackOutput": cb.track_output,
        "LastOutput": cb.last_output,
        "auto": false, // Would be set based on automatic mode
    })
}

/// Format a command for the command block, mirroring the formatter from the JS file.
/// In a full port, this would use game.commands.format()
pub fn format_command(command: &str, offset: i32, current: &str) -> String {
    // Basic formatting - in full port would use game.commands.format()
    current.to_string() + "\n" + command
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_block_new() {
        let cb = CommandBlock::new("command_block".to_string());
        assert_eq!(cb.name, "command_block");
        assert_eq!(cb.mode, CommandBlockMode::CommandBlock);
        assert!(!cb.conditional);
        assert!(cb.command.is_empty());
        assert!(cb.track_output);
        assert!(cb.last_output.is_none());
    }

    #[test]
    fn test_command_block_set_command() {
        let mut cb = CommandBlock::new("command_block".to_string());
        cb.set_command("give @p diamond 1");
        assert_eq!(cb.command(), "give @p diamond 1");
    }

    #[test]
    fn test_command_block_mode_to_string() {
        let cb = CommandBlock::new("command_block".to_string())
            .with_mode(CommandBlockMode::RepeatingCommandBlock);
        assert_eq!(cb.mode_to_string(), "AUTO");

        let cb = CommandBlock::new("command_block".to_string())
            .with_mode(CommandBlockMode::ChainCommandBlock);
        assert_eq!(cb.mode_to_string(), "SEQUENCE");
    }

    #[test]
    fn test_command_block_mode_from_string() {
        assert_eq!(mode_from_string("REDSTONE"), CommandBlockMode::CommandBlock);
        assert_eq!(mode_from_string("AUTO"), CommandBlockMode::RepeatingCommandBlock);
        assert_eq!(mode_from_string("SEQUENCE"), CommandBlockMode::ChainCommandBlock);
        assert_eq!(mode_from_string("UNKNOWN"), CommandBlockMode::CommandBlock);
    }

    #[test]
    fn test_command_block_to_json() {
        let cb = CommandBlock::new("command_block".to_string())
            .set_command("give @p diamond 1")
            .set_track_output(true);
        let json = command_block_to_json(&cb);
        assert!(json.get("Command").is_some());
        assert!(json.get("TrackOutput").is_some());
    }
}