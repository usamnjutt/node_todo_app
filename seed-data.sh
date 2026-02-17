#!/bin/bash

echo "🌱 Seeding database with sample data..."

# Wait for database to be ready
sleep 5

# Run seed SQL
docker exec -i todo-postgres psql -U $DB_USER -d $DB_NAME << EOF
INSERT INTO todos (title, completed, created_at) VALUES
    ('Learn Docker basics', true, NOW() - INTERVAL '2 days'),
    ('Build a CI/CD pipeline', false, NOW() - INTERVAL '1 day'),
    ('Implement GitHub Secrets', false, NOW()),
    ('Create live demo for lead', false, NOW()),
    ('Deploy to production', false, NOW() + INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;
EOF

echo "✅ Database seeded successfully!"
