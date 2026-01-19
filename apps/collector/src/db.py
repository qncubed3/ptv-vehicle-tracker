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
        return psycopg2.connect(self.database_url)
    
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
        if not vehicles:
            return 0
        
        connection = self._get_connection()
        cursor = connection.cursor()
        
        # Prepare values as tuples
        values = [
            (
                v.get('vehicle_id'),
                v.get('route_id'),
                v.get('run_id'),
                v.get('latitude'),
                v.get('longitude'),
                v.get('timestamp'),
                v.get('direction_id'),
                v.get('heading'),
                v.get('route_type', 0)
            )
            for v in vehicles
        ]
        
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
            return 0
        finally:
            cursor.close()
            connection.close()
    
    def cleanup_old_data(self, hours=24):
        """
        Delete records older than specified hours
        """

        query = """
            DELETE FROM vehicle_locations
            WHERE timestamp < NOW() - INTERVAL '%s hours'
        """
        
        result = self.execute(query, (hours,))
        return 0
    
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
    
    try:
        return PostgresDatabase(config['database_url'])
    except Exception as e:
        print(f"Error: {e}")


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