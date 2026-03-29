<div align="center">
  <h1>🚗 Parking Lot Management System</h1>
  <p>A comprehensive Database Management System (DBMS) project to manage parking lots efficiently.</p>
</div>

## 📖 Overview
The **Parking Lot Management System** is a full-stack application designed to streamline the operations of a multi-floor parking facility. The system securely tracks incoming vehicles, allocates available parking slots based on vehicle type, manages time-based tickets, and processes payments upon exit. Check out the backend REST APIs and the intuitive user interface designed for operators and admins.

## ✨ Features
- **Multi-Level Lot Management**: Organizes parking by floors, slots, and gates (Entry/Exit).
- **Intelligent Slot Allocation**: Handles different parking spot types (Car, Bike, Truck) and checks real-time occupancy.
- **Ticketing & Payments**: Generates tickets with entry timestamps and tracks active parking sessions. Upon checkout, calculates the fee using configurable pricing rules and logs payment history.
- **Robust Database Logic**: Uses enterprise-grade relational database design (Oracle) equipped with automated PL/SQL triggers for data integrity and constraints.
- **Modern User Interface**: A fast, responsive frontend application for operators to interact with the system seamlessly.

## 💻 Tech Stack
- **Frontend**: React.js, Vite, Tailwind CSS
- **Backend**: Java, Spring Boot, Spring Data JPA, Maven
- **Database**: Oracle Database (accessed via JDBC), PL/SQL

## 📂 Project Structure
```text
Parking_Lot_System/
├── backend/          # Spring Boot application (REST APIs)
├── frontend/         # React SPA using Vite and Tailwind CSS
├── db/               # Oracle SQL schema, PL/SQL scripts, triggers, and seed data
└── README.md         # Project documentation
```

## 🛠️ Setup & Installation

### Prerequisites
- Java 17+
- Node.js (v18+) & npm
- Oracle Database server (or Oracle XE) accessible locally

### 1. Database Configuration
1. Start your local Oracle Database instance.
2. Navigate to the `db/` folder and execute the scripts in the following order:
   - `1_schema.sql` (Drops legacy tables, creates the schema, and inserts seed data)
   - `2_plsql.sql` (Procedures and Functions)
   - `Triggers.sql` (Database Triggers)
   - `4_pricing.sql` (Creates supplementary pricing logic)

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Make sure your database credentials match the configuration in `src/main/resources/application.properties`:
   ```properties
   spring.datasource.url=jdbc:oracle:thin:@localhost:1522/XEPDB1
   spring.datasource.username=system
   spring.datasource.password=admin123
   ```
3. Run the Spring Boot application:
   ```bash
   mvn spring-boot:run
   ```
   *The server will start on port `8082`.*

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```

## 📊 Database Schema Relationships
- **ParkingLot ↔ Floor**: One-to-Many (Composition)
- **Floor ↔ ParkingSlot**: One-to-Many (Composition)
- **ParkingSlot ↔ Ticket**: One-to-Many
- **Vehicle ↔ Ticket**: One-to-Many
- **Ticket ↔ Payment**: One-to-One
- **ParkingLot ↔ Gate**: One-to-Many

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

## 📝 License
This project is open-source and available under the MIT License.