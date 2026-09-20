import asyncio
import asyncpg

async def main():
    # Intenta con la contraseña por defecto 'postgres' en el puerto 5432
    # Si cambiaste la contraseña al instalar PostgreSQL, edítala aquí.
    db_url = 'postgresql://postgres:postgres@localhost:5432/postgres'
    try:
        conn = await asyncpg.connect(db_url)
        await conn.execute('CREATE DATABASE sspillowy_db;')
        print('Base de datos sspillowy_db creada con exito!')
        await conn.close()
    except asyncpg.exceptions.DuplicateDatabaseError:
        print('La base de datos sspillowy_db ya existe.')
    except Exception as e:
        print(f'Error al conectar: {e}')

asyncio.run(main())
