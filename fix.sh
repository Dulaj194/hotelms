docker exec hotelms-mysql mysql -uroot -photelms123 -e "DROP DATABASE IF EXISTS hotelms; CREATE DATABASE hotelms;"
cd ~/hotelms
export DOCKER_USERNAME=dulaj1
docker compose -f docker-compose.prod.yml run --rm backend sh -c "python -c \"from app.db.session import engine; from app.db.base import Base; import app.db.init_models; Base.metadata.create_all(bind=engine)\" && alembic stamp head"
docker compose -f docker-compose.prod.yml start backend
