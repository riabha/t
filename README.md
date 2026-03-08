# Timetable Management System

A comprehensive timetable management system for universities with automated scheduling, constraint handling, and PDF export capabilities.

## Features

- 🎓 Multi-department timetable management
- 👨‍🏫 Teacher and lab engineer scheduling
- 🏫 Room allocation and conflict detection
- 🔒 User authentication and role-based access
- 📊 VC Master Dashboard with university-wide overview
- 📄 PDF export with A3 format support
- 🔄 Automated constraint solving using OR-Tools
- 🚫 Teacher restrictions and preferences
- 📱 Responsive web interface

## Tech Stack

### Backend
- FastAPI (Python)
- SQLAlchemy ORM
- PostgreSQL (Production) / SQLite (Development)
- OR-Tools for optimization
- JWT Authentication

### Frontend
- React + Vite
- Tailwind CSS
- React Router
- Axios for API calls
- jsPDF for PDF generation

## Quick Start (Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- SQLite (included)

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Production Deployment (Contabo with aaPanel)

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed step-by-step instructions.

### Quick Deploy
```bash
# Clone repository
git clone https://github.com/riabha/t.git timetable
cd timetable

# Create environment file
cp .env.example .env
nano .env  # Add your passwords

# Deploy with Docker
chmod +x deploy.sh
./deploy.sh
```

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI application
│   ├── models.py            # Database models
│   ├── database.py          # Database configuration
│   ├── auth.py              # Authentication
│   ├── solver.py            # Timetable optimization
│   ├── routers/             # API endpoints
│   └── migrations/          # Database migrations
├── frontend/
│   ├── src/
│   │   ├── pages/           # React pages
│   │   ├── components/      # Reusable components
│   │   ├── context/         # React context
│   │   └── layouts/         # Layout components
│   └── public/              # Static assets
├── docker-compose.prod.yml  # Production Docker setup
└── DEPLOYMENT_GUIDE.md      # Deployment instructions
```

## Default Credentials

After deployment, create your admin user or use the seeded data.

## API Documentation

Once running, visit:
- API Docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Database Migration

### Export from SQLite (Local)
```bash
cd backend
python export_data.py
```

### Import to PostgreSQL (Server)
```bash
docker cp backend/data_export.json tt-backend:/app/
docker exec -it tt-backend python import_data.py
```

## Maintenance

### View Logs
```bash
docker logs tt-backend
docker logs tt-frontend
docker logs tt-postgres
```

### Restart Services
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Backup Database
```bash
docker exec tt-postgres pg_dump -U timetable_user timetable_db > backup.sql
```

### Update Application
```bash
git pull origin main
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

## License

Proprietary - QUEST University

## Support

For issues and questions, contact the development team.
