from psycopg2.extras import execute_values
import psycopg2
import os

class PostgresDatabase:
    """
    Direct PostgreSQL database connection
    """
    
    def __init__(self, database_url):
        """
        Initialize database connection
        """
        
        self.database_url = database_url

    
    def _get_connection(self):
        """
        Create a new database connection
        """
        return psycopg2.connect(
            self.database_url,
            connect_timeout=10
        )
    
    def execute(self, query, params=None):
        """
        Execute a SQL query
        """

        connection = self._get_connection()
        cursor = connection.cursor()
        
        try:
            cursor.execute(query, params or ())
            connection.commit()
            
            if cursor.description:
                return cursor.fetchall()
            return None
        except Exception as e:
            connection.rollback()
            print(f"Database error: {e}")
            raise
        finally:
            cursor.close()
            connection.close()
    

    def insert_vehicle(self, vehicle):
        """
        Insert a single vehicle location
        """
        query = """
            INSERT INTO vehicle_locations 
            (vehicle_id, route_id, run_id, latitude, longitude, timestamp, direction_id, heading, route_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (vehicle_id, timestamp) DO NOTHING
        """
        
        params = (
            vehicle.get('vehicle_id'),
            vehicle.get('route_id'),
            vehicle.get('run_id'),
            vehicle.get('latitude'),
            vehicle.get('longitude'),
            vehicle.get('timestamp'),
            vehicle.get('direction_id'),
            vehicle.get('heading'),
            vehicle.get('route_type', 0)
        )
        
        self.execute(query, params)
    

    def insert_vehicles_bulk(self, vehicles):
        """
        Insert many vehicle locations in one query.
        Returns the number of rows attempted on success, or None on failure.
        """
        if not vehicles:
            return 0

        # Drop incomplete rows before they hit Postgres.
        values = []
        for vehicle in vehicles:
            vehicle_id = vehicle.get('vehicle_id')
            timestamp = vehicle.get('timestamp')
            latitude = vehicle.get('latitude')
            longitude = vehicle.get('longitude')

            if not vehicle_id or not timestamp:
                continue

            if latitude is None or longitude is None:
                continue

            values.append((
                vehicle_id,
                vehicle.get('route_id'),
                vehicle.get('run_id'),
                latitude,
                longitude,
                timestamp,
                vehicle.get('direction_id'),
                vehicle.get('heading'),
                vehicle.get('route_type', 0)
            ))

        if not values:
            return 0
        
        connection = self._get_connection()
        cursor = connection.cursor()
        
        query = """
            INSERT INTO vehicle_locations
            (vehicle_id, route_id, run_id, latitude, longitude, timestamp, direction_id, heading, route_type)
            VALUES %s
            ON CONFLICT (vehicle_id, timestamp) DO NOTHING
        """
        
        try:
            execute_values(cursor, query, values)
            connection.commit()
            print(f"Bulk inserted {len(values)} vehicles")
            return len(values)
        except Exception as e:
            connection.rollback()
            print(f"Error bulk inserting vehicles: {e}")
            return None
        finally:
            cursor.close()
            connection.close()
    
    def cleanup_old_data(self, hours=24):
        """
        Delete records older than the given number of hours.
        Returns how many rows were deleted.
        """

        deleted = 0
        connection = self._get_connection()
        cursor = connection.cursor()

        # Multiply an interval so the hour count is a real query parameter.
        query = """
            DELETE FROM vehicle_locations
            WHERE timestamp < NOW() - (%s * INTERVAL '1 hour')
        """

        try:
            cursor.execute(query, (hours,))
            deleted = cursor.rowcount
            connection.commit()
        except Exception as e:
            connection.rollback()
            print(f"Cleanup error: {e}")
            return 0
        finally:
            cursor.close()
            connection.close()

        # Reclaim disk space from deleted rows so Supabase quota can shrink.
        # VACUUM cannot run inside a transaction, so use a fresh connection.
        try:
            vacuum_connection = self._get_connection()
            vacuum_connection.autocommit = True
            vacuum_cursor = vacuum_connection.cursor()
            try:
                vacuum_cursor.execute("VACUUM vehicle_locations")
            finally:
                vacuum_cursor.close()
                vacuum_connection.close()
        except Exception as e:
            print(f"VACUUM warning: {e}")

        return deleted

    def get_stats(self):
        """
        Get database statistics
        """

        query = """
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT vehicle_id) as unique_vehicles,
                MIN(timestamp) as oldest_record,
                MAX(timestamp) as newest_record
            FROM vehicle_locations
        """
        
        result = self.execute(query)
        if result and result[0]:
            row = result[0]
            return {
                'total_records': row[0],
                'unique_vehicles': row[1],
                'oldest_record': row[2],
                'newest_record': row[3]
            }
        return {}


def create_database(config):
    """
    Create database instance
    """
    if not config.get('database_url'):
        raise ValueError("DATABASE_URL not provided in configuration")
    
    return PostgresDatabase(config['database_url'])


if __name__ == '__main__':
    """
    Test database connections
    """

    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("Loaded .env file")
    except Exception as e:
        print(f"Error: {e}")
    
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("Error: Cannot find DATABASE_URL environment variable")
        exit(1)
    
    print("Testing database connection...")
    
    try:
        db = PostgresDatabase(database_url)
        stats = db.get_stats()
        print(f"Database stats: {stats}")
        
    except Exception as e:
        print(f"Error: {e}")
