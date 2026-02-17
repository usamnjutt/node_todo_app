-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS todos (
	    id SERIAL PRIMARY KEY,
	    title VARCHAR(255) NOT NULL,
	    completed BOOLEAN DEFAULT false,
	    created_at TIMESTAMP DEFAULT NOW()
	);

	-- Insert sample data
INSERT INTO todos (title, completed, created_at) VALUES
    ('Learn Docker basics', true, NOW() - INTERVAL '2 days'),
    ('Build a CI/CD pipeline', false, NOW() - INTERVAL '1 day'),
    ('Implement GitHub Secrets', false, NOW()),
    ('Create live demo for lead', false, NOW()),
    ('Deploy to production', false, NOW() + INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;
