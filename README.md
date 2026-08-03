# @datalathe/tui

Terminal UI for [DataLathe](https://github.com/DataLathe) — manage chips, run queries, and explore databases from your terminal.

## Installation

```bash
npm install -g @datalathe/tui
```

## Usage

```bash
datalathe-tui
```

On launch, enter your DataLathe engine URL (e.g. `http://localhost:3000`) to connect.

### Features

- Browse databases and table schemas
- Filter the chip list as you type (press `/`) by name, ID, table, or tag
- Search chips server-side by table name, partition value, or tag
- Create chips from database queries or local files (CSV, Parquet, etc.)
- Create a new chip from existing chips
- Run SQL queries against chips
- Run raw SQL directly against a chip's underlying catalog
- Extract referenced tables from SQL
- Manage, test, and re-attach saved database connections
- Download engine and chip-manager binaries
- Start and stop the local engine and chip-manager in the background (they keep running after the TUI exits)
- View query results in a formatted table
- Tab-completion for file paths

## Requirements

- Node.js >= 18
- A running DataLathe engine

## License

MIT
