# Backend

API y lógica de servidor de EduSmart. Aquí se gestionan autenticación, endpoints, reglas de negocio y la comunicación con la base de datos.

## Base de datos con Docker

`npm run db:setup` levanta MySQL en Docker (puerto 3307) y aplica las migraciones con registro. Guía completa: [docs/DOCKER_DATABASE.md](docs/DOCKER_DATABASE.md).
