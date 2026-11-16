-- =====================================================================
-- ThermoCare IoT · Equipo 5 · Grupo 504
-- Script de creación de la base de datos thermocare (MySQL 8.0, InnoDB)
-- 12 tablas: PACIENTE, DISPOSITIVO, LECTURA, ONDA_CALOR, ALERTA,
-- MEDICAMENTO, PERSONAL_MEDICO, PERSONA_APOYO, TELEFONO_PERSONAL,
-- TELEFONO_APOYO, TRATA y APOYA
-- =====================================================================

DROP DATABASE IF EXISTS thermocare;
CREATE DATABASE thermocare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE thermocare;

-- Parche que lleva cada paciente
CREATE TABLE DISPOSITIVO (
  id_dispositivo INT AUTO_INCREMENT PRIMARY KEY,
  numero_serie   VARCHAR(20) NOT NULL UNIQUE,
  fecha_alta     DATE        NOT NULL
) ENGINE = InnoDB;

-- Paciente en quimioterapia; usa exactamente un dispositivo
CREATE TABLE PACIENTE (
  id_paciente      INT AUTO_INCREMENT PRIMARY KEY,
  nombres          VARCHAR(50)  NOT NULL,
  apellido_paterno VARCHAR(50)  NOT NULL,
  apellido_materno VARCHAR(50)  NULL,
  fecha_nacimiento DATE         NOT NULL,
  sexo             CHAR(1)      NOT NULL,
  estatura_cm      INT          NOT NULL,
  peso_kg          DECIMAL(5,2) NOT NULL,
  id_dispositivo   INT          NOT NULL UNIQUE,
  CONSTRAINT chk_paciente_sexo CHECK (sexo IN ('F','M')),
  CONSTRAINT fk_paciente_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES DISPOSITIVO (id_dispositivo) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

-- Cada medición que manda el parche
CREATE TABLE LECTURA (
  id_lectura           INT AUTO_INCREMENT PRIMARY KEY,
  id_dispositivo       INT          NOT NULL,
  fecha_hora           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  temp_piel            DECIMAL(5,2) NOT NULL,
  temp_flujo           DECIMAL(5,2) NOT NULL,
  temp_cuarto          DECIMAL(5,2) NOT NULL,
  temp_nucleo          DECIMAL(5,2) NULL,
  parche_colocado      BOOLEAN      NOT NULL,
  calentador_encendido BOOLEAN      NOT NULL DEFAULT 0,
  CONSTRAINT chk_lectura_rangos CHECK (temp_piel BETWEEN 0 AND 50 AND temp_flujo BETWEEN 0 AND 50 AND temp_cuarto BETWEEN 0 AND 50),
  CONSTRAINT fk_lectura_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES DISPOSITIVO (id_dispositivo) ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_lectura_dispositivo_fecha (id_dispositivo, fecha_hora)
) ENGINE = InnoDB;

-- Cada pulso u onda de calor que emite el calentador
CREATE TABLE ONDA_CALOR (
  id_onda        INT AUTO_INCREMENT PRIMARY KEY,
  id_dispositivo INT          NOT NULL,
  tipo           VARCHAR(15)  NOT NULL,
  potencia       INT          NOT NULL,
  fecha_inicio   DATETIME     NOT NULL,
  fecha_fin      DATETIME     NULL,
  grosor_grasa   DECIMAL(4,1) NULL,
  CONSTRAINT chk_onda_tipo CHECK (tipo IN ('pulso_10s','onda_1min','onda_5min','onda_15min')),
  CONSTRAINT chk_onda_potencia CHECK (potencia BETWEEN 0 AND 100),
  CONSTRAINT fk_onda_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES DISPOSITIVO (id_dispositivo) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE = InnoDB;

-- Médicos y enfermería
CREATE TABLE PERSONAL_MEDICO (
  id_personal INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  rol         VARCHAR(15)  NOT NULL,
  correo      VARCHAR(100) NOT NULL UNIQUE,
  contrasena  VARCHAR(255) NOT NULL,
  telegram_id BIGINT       NULL UNIQUE,
  CONSTRAINT chk_personal_rol CHECK (rol IN ('medico','enfermeria'))
) ENGINE = InnoDB;

-- Familiares o cuidadores
CREATE TABLE PERSONA_APOYO (
  id_apoyo    INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  rol         VARCHAR(15)  NOT NULL,
  correo      VARCHAR(100) NOT NULL UNIQUE,
  contrasena  VARCHAR(255) NOT NULL,
  telegram_id BIGINT       NULL UNIQUE
) ENGINE = InnoDB;

-- Teléfonos (atributo multivaluado)
CREATE TABLE TELEFONO_PERSONAL (
  id_personal INT         NOT NULL,
  telefono    VARCHAR(15) NOT NULL,
  PRIMARY KEY (id_personal, telefono),
  CONSTRAINT fk_telpersonal FOREIGN KEY (id_personal)
    REFERENCES PERSONAL_MEDICO (id_personal) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE TELEFONO_APOYO (
  id_apoyo INT         NOT NULL,
  telefono VARCHAR(15) NOT NULL,
  PRIMARY KEY (id_apoyo, telefono),
  CONSTRAINT fk_telapoyo FOREIGN KEY (id_apoyo)
    REFERENCES PERSONA_APOYO (id_apoyo) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

-- Relación M:N: qué personal médico trata a cada paciente
CREATE TABLE TRATA (
  id_personal INT NOT NULL,
  id_paciente INT NOT NULL,
  PRIMARY KEY (id_personal, id_paciente),
  CONSTRAINT fk_trata_personal FOREIGN KEY (id_personal) REFERENCES PERSONAL_MEDICO (id_personal) ON DELETE CASCADE,
  CONSTRAINT fk_trata_paciente FOREIGN KEY (id_paciente) REFERENCES PACIENTE (id_paciente) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Relación M:N: qué personas de apoyo acompañan a cada paciente
CREATE TABLE APOYA (
  id_apoyo    INT NOT NULL,
  id_paciente INT NOT NULL,
  PRIMARY KEY (id_apoyo, id_paciente),
  CONSTRAINT fk_apoya_apoyo FOREIGN KEY (id_apoyo) REFERENCES PERSONA_APOYO (id_apoyo) ON DELETE CASCADE,
  CONSTRAINT fk_apoya_paciente FOREIGN KEY (id_paciente) REFERENCES PACIENTE (id_paciente) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Alertas de fiebre o de parche despegado
CREATE TABLE ALERTA (
  id_alerta   INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente INT          NOT NULL,
  id_personal INT          NULL,
  tipo        VARCHAR(20)  NOT NULL,
  temperatura DECIMAL(5,2) NULL,
  fecha_hora  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atendida    BOOLEAN      NOT NULL DEFAULT 0,
  CONSTRAINT chk_alerta_tipo CHECK (tipo IN ('fiebre','revisar_parche')),
  CONSTRAINT fk_alerta_paciente FOREIGN KEY (id_paciente) REFERENCES PACIENTE (id_paciente) ON DELETE CASCADE,
  CONSTRAINT fk_alerta_personal FOREIGN KEY (id_personal) REFERENCES PERSONAL_MEDICO (id_personal) ON DELETE SET NULL,
  INDEX idx_alerta_paciente (id_paciente, atendida, fecha_hora)
) ENGINE = InnoDB;

-- Medicamentos que pueden ocultar la fiebre
CREATE TABLE MEDICAMENTO (
  id_medicamento INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente    INT          NOT NULL,
  nombre         VARCHAR(50)  NOT NULL,
  dosis_mg       DECIMAL(6,2) NULL,
  fecha_hora     DATETIME     NOT NULL,
  CONSTRAINT fk_medicamento_paciente FOREIGN KEY (id_paciente) REFERENCES PACIENTE (id_paciente) ON DELETE CASCADE
) ENGINE = InnoDB;
