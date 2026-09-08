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
- Run raw SQL directly against a chip's underlying catalog, with a Tab picker that inserts table references (including UNION ALL across partitions)
- Extract referenced tables from SQL
- Manage, test, and re-attach saved database connections
- Download engine and chip-manager binaries
- Start and stop the local engine and chip-manager in the background (they keep running after the TUI exits)
- View query results in a formatted table
- Tab-completion for file paths

## Requirements

- Node.js >= 20
- A running DataLathe engine

### Corporate CA / TLS inspection

The TUI trusts your operating system's certificate store automatically. If your network performs TLS inspection with a private CA, set `DATALATHE_CA_BUNDLE` to the path of a PEM bundle containing that CA (or use Node's `NODE_EXTRA_CA_CERTS`) before launching.

## License

MIT
