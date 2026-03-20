CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    description TEXT
);


CREATE TABLE dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id UUID,
    dependency_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (dependency_id) REFERENCES dependencies(id)
);

-- servira para plantillas de los documentos
CREATE TABLE document_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dependency_id UUID,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (dependency_id) REFERENCES dependencies(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

--cada campo de la plantilla
CREATE TABLE template_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL,
    field_name VARCHAR(150) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    required BOOLEAN DEFAULT FALSE,
    position INTEGER,

    FOREIGN KEY (template_id) REFERENCES document_templates(id)
);

--documrentos enviados con su respectiva notificacion
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL,
    dependency_id UUID NOT NULL,
    created_by UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    submitted_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (template_id) REFERENCES document_templates(id),
    FOREIGN KEY (dependency_id) REFERENCES dependencies(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- respueta de confirmacion o rechazo del documento
CREATE TABLE document_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    field_id UUID NOT NULL,
    value TEXT,

    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (field_id) REFERENCES template_fields(id)
);

-- se revisa aqui el departamento de planeacion
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    status VARCHAR(50),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

-- se crea un sello digital mediante hash
CREATE TABLE digital_seals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    approved_by UUID NOT NULL,
    seal_hash TEXT NOT NULL,
    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

--rodos los reportes
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL,
    generated_by UUID,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- (para rendimiento)
CREATE INDEX idx_documents_dependency
ON documents(dependency_id);

CREATE INDEX idx_documents_status
ON documents(status);

CREATE INDEX idx_reviews_document
ON reviews(document_id);

CREATE INDEX idx_document_data_document
ON document_data(document_id);

-- VISTA PARA REPORTES
CREATE VIEW report_view AS
SELECT
d.id,
dep.name AS dependencia,
d.status,
d.submitted_at,
r.comments,
ds.approved_at
FROM documents d
LEFT JOIN dependencies dep ON d.dependency_id = dep.id
LEFT JOIN reviews r ON r.document_id = d.id
LEFT JOIN digital_seals ds ON ds.document_id = d.id;