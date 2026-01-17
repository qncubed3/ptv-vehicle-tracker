"""
Configuration management - loads settings from environment variables
"""
import os
from dotenv import load_dotenv


def _env_bool(name, default=False):
    """Convert environment variable to boolean"""
    val = os.getenv(name)
    if val is None:
        return default
    return val.lower() in ("1", "true", "yes", "on")


def load_config():
    """
    Load configuration from environment variables
    
    Returns:
        dict: Configuration dictionary with all settings
    
    Raises:
        ValueError: If required environment variables are missing
    """
    # Load .env file
    load_dotenv()

    config = {
        'ptv_user_id': os.getenv('PTV_USER_ID'),
        'ptv_api_key': os.getenv('PTV_API_KEY'),
        'database_url': os.getenv('DATABASE_URL'),
        'poll_interval': int(os.getenv('POLL_INTERVAL', '30')),
        'parallel_workers': int(os.getenv('PARALLEL_WORKERS', '10')),
        'enable_db_write': _env_bool('ENABLE_DB_WRITE', default=True),
    }
    
    # Validate required fields
    required = ['ptv_user_id', 'ptv_api_key']
    
    # DATABASE_URL only required if writes are enabled
    if config['enable_db_write']:
        required.append('database_url')
    
    missing = [key for key in required if not config[key]]
    
    if missing:
        print("Current config:", config)
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
    
    return config


def print_config(config):
    """Print configuration (hiding sensitive data)"""
    print("\n" + "="*60)
    print("CONFIGURATION")
    print("="*60)
    print(f"PTV User ID: {config['ptv_user_id'][:10]}..." if config['ptv_user_id'] else "Not set")
    print(f"PTV API Key: {'*' * 20}")
    
    if config['enable_db_write']:
        print(f"Database: {config['database_url'][:30]}..." if config['database_url'] else "Not set")
    else:
        print(f"Database: [Disabled - Dry-run mode]")
    
    print(f"Poll Interval: {config['poll_interval']} seconds")
    print(f"Max Parallel Workers: {config['parallel_workers']}")
    print(f"DB Writes: {'ENABLED' if config['enable_db_write'] else 'DISABLED (dry-run)'}")
    print("="*60 + "\n")