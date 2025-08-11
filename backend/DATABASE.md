# Persistent Database System

The backend now uses a **persistent SQLite database** instead of rebuilding data in memory on every restart.

## Benefits

### 🚀 **Massive Performance Improvement**
- **Before**: 5-15 minutes startup time (rebuilding 1.5GB+ of data)
- **After**: ~2-5 seconds startup time (if database exists)

### 💾 **Efficient Storage**
- **Before**: All data in RAM (~2-4GB memory usage)
- **After**: Data on disk, minimal memory footprint

### 🔄 **Smart Updates**
- Automatically detects when GeoJSON files change
- Only rebuilds when necessary
- Preserves database across server restarts

## Usage

### Normal Startup
```bash
python3 main.py
```
- Checks if database exists and is current
- Skips rebuild if data is up-to-date
- Fast startup (2-5 seconds)

### Force Rebuild
```bash
python3 main.py --rebuild-db
```
- Forces complete database rebuild
- Use when you want fresh data processing
- Takes full time (5-15 minutes) but ensures clean state

### Custom Port
```bash
python3 main.py --port 8080
```

### Database Management
```bash
# Check database status
python3 db_manager.py --info

# Delete database (forces rebuild on next start)
python3 db_manager.py --delete
```

## How It Works

### File Change Detection
- Calculates MD5 checksum of all GeoJSON files
- Includes filename, size, and modification time
- Stores checksum in database
- Compares on startup to detect changes

### Database Structure
- **`polygon_features`**: Polygon geometries with spatial indexes
- **`point_features`**: Point geometries with spatial indexes  
- **`layer_metadata`**: Layer information and statistics
- **`database_checksum`**: File change detection

### Performance Characteristics
| Operation | In-Memory | Persistent |
|-----------|-----------|------------|
| First startup | 5-15 min | 5-15 min |
| Subsequent restarts | 5-15 min | 2-5 sec |
| Memory usage | 2-4 GB | 200-500 MB |
| Disk usage | 0 MB | 500-1000 MB |

## Database File
- **Location**: `spatial_data.db` (in backend directory)
- **Size**: ~500-1000 MB (compressed spatial data)
- **Format**: SQLite with spatial indexes

## Troubleshooting

### Database Corruption
```bash
python3 db_manager.py --delete
python3 main.py --rebuild-db
```

### File Changes Not Detected
- Check file permissions
- Manually force rebuild with `--rebuild-db`

### Slow Queries
- Database indexes are created automatically
- Check disk I/O performance
- Consider SSD storage for best performance

## Development Workflow

### Data Changes
When you modify GeoJSON files:
1. Restart server normally - it will auto-detect changes
2. OR use `--rebuild-db` for explicit rebuild

### Schema Changes
When you modify database schema:
1. Use `--rebuild-db` to recreate tables
2. OR delete database and restart

### Testing
```bash
# Quick check
python3 db_manager.py --info

# Clean slate
python3 db_manager.py --delete
python3 main.py --rebuild-db
``` 