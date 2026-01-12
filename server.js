const express = require('express');
const mysql = require('mysql2/promise'); // Promise version
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// MySQL Connection Pool (Better performance)
let db;

// Initialize database connection
const initializeDB = async () => {
    try {
        db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'car_workshop_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log('✅ Connected to MariaDB: car_workshop_db');
        
        // Check if tables exist
        const [tables] = await db.query('SHOW TABLES');
        console.log('📊 Available tables:', tables.map(t => t.Tables_in_car_workshop_db));
        
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        console.log('⚠️ Make sure:');
        console.log('   1. MariaDB is running');
        console.log('   2. Database "car_workshop_db" exists');
        console.log('   3. Username/password is correct');
        process.exit(1);
    }
};

// ==================== API ROUTES ====================

// 1. Get all mechanics (for dropdown)
app.get('/api/mechanics', async (req, res) => {
    try {
        const query = 'SELECT id, name, specialty FROM mechanics ORDER BY name';
        const [mechanics] = await db.query(query);
        
        console.log(`✅ Fetched ${mechanics.length} mechanics`);
        res.json(mechanics);
        
    } catch (err) {
        console.error('❌ Error fetching mechanics:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch mechanics' 
        });
    }
});

// 2. Book appointment (MAIN LOGIC)
app.post('/api/book-appointment', async (req, res) => {
    try {
        const { 
            name, 
            address, 
            phone, 
            license_no, 
            engine_no, 
            date: appointment_date, 
            mechanic_id 
        } = req.body;

        console.log('📝 Appointment request:', { name, phone, appointment_date, mechanic_id });

        // Input validation
        if (!name || !address || !phone || !license_no || !engine_no || !appointment_date || !mechanic_id) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required information'
            });
        }

        // Validation 1: Check if user already has appointment on same date
        const checkUserQuery = `SELECT id FROM appointments WHERE phone = ? AND appointment_date = ?`;
        const [userAppointments] = await db.query(checkUserQuery, [phone, appointment_date]);
        
        if (userAppointments.length > 0) {
            console.log(`⚠️ User ${phone} already has appointment on ${appointment_date}`);
            return res.json({
                success: false,
                message: 'You already have an appointment on this date!'
            });
        }

        // Validation 2: Check mechanic's daily limit (max 4 appointments per day)
        const checkMechanicLimit = `SELECT COUNT(*) as total FROM appointments WHERE mechanic_id = ? AND appointment_date = ?`;
        const [limitResults] = await db.query(checkMechanicLimit, [mechanic_id, appointment_date]);
        
        const totalAppointments = limitResults[0].total;
        
        if (totalAppointments >= 4) {
            console.log(`⚠️ Mechanic ${mechanic_id} has reached limit (4/4) on ${appointment_date}`);
            return res.json({
                success: false,
                message: 'Sorry, this mechanic is fully booked for this date. Please select another mechanic or date.'
            });
        }

        console.log(`✅ Mechanic ${mechanic_id} has ${totalAppointments}/4 appointments on ${appointment_date}`);

        // Insert appointment
        const insertQuery = `
            INSERT INTO appointments (name, address, phone, license_no, engine_no, appointment_date, mechanic_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await db.query(insertQuery, 
            [name, address, phone, license_no, engine_no, appointment_date, mechanic_id]
        );
        
        console.log(`✅ Appointment booked! ID: ${result.insertId}`);
        res.json({
            success: true,
            message: 'Your appointment has been successfully booked!',
            appointmentId: result.insertId
        });

    } catch (err) {
        console.error('❌ Error booking appointment:', err.message);
        res.status(500).json({
            success: false,
            message: 'Database error occurred'
        });
    }
});

// 3. Get all appointments for admin panel
app.get('/api/admin/appointments', async (req, res) => {
    try {
        const query = `
            SELECT a.*, m.name as mechanic_name 
            FROM appointments a 
            JOIN mechanics m ON a.mechanic_id = m.id
            ORDER BY a.appointment_date DESC, a.created_at DESC
        `;
        
        const [appointments] = await db.query(query);
        
        console.log(`✅ Fetched ${appointments.length} appointments for admin`);
        res.json(appointments);
        
    } catch (err) {
        console.error('❌ Error fetching appointments:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch appointments' 
        });
    }
});

// 4. GET single appointment by ID
app.get('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT a.*, m.name as mechanic_name, m.specialty 
            FROM appointments a 
            JOIN mechanics m ON a.mechanic_id = m.id
            WHERE a.id = ?
        `;
        
        const [appointments] = await db.query(query, [id]);
        
        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        res.json({
            success: true,
            appointment: appointments[0]
        });
        
    } catch (err) {
        console.error('❌ Error fetching appointment:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch appointment' 
        });
    }
});

// 5. UPDATE appointment
app.put('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, 
            address, 
            phone, 
            license_no, 
            engine_no, 
            appointment_date, 
            mechanic_id,
            status 
        } = req.body;

        // Check if appointment exists
        const [existing] = await db.query('SELECT id FROM appointments WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        const updateQuery = `
            UPDATE appointments 
            SET name = ?, address = ?, phone = ?, license_no = ?, engine_no = ?, 
                appointment_date = ?, mechanic_id = ?
            WHERE id = ?
        `;

        // শুধুমাত্র প্রয়োজনীয় ডেটাগুলো পাঠান
        await db.query(updateQuery, 
            [name, address, phone, license_no, engine_no, appointment_date, mechanic_id, id]
        );



        console.log(`✅ Appointment ${id} updated`);
        res.json({
            success: true,
            message: 'Appointment updated successfully'
        });
        
    } catch (err) {
        console.error('❌ Error updating appointment:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update appointment' 
        });
    }
});

// 6. DELETE appointment
app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if appointment exists
        const [existing] = await db.query('SELECT id FROM appointments WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Delete appointment
        await db.query('DELETE FROM appointments WHERE id = ?', [id]);
        
        console.log(`✅ Appointment ${id} deleted`);
        res.json({
            success: true,
            message: 'Appointment deleted successfully'
        });
        
    } catch (err) {
        console.error('❌ Error deleting appointment:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete appointment' 
        });
    }
});

// 7. GET mechanics with appointment counts
app.get('/api/mechanics-with-stats', async (req, res) => {
    try {
        const query = `
            SELECT m.*, 
                   COUNT(a.id) as total_appointments,
                   SUM(CASE WHEN a.appointment_date = CURDATE() THEN 1 ELSE 0 END) as today_appointments
            FROM mechanics m
            LEFT JOIN appointments a ON m.id = a.mechanic_id
            GROUP BY m.id
            ORDER BY m.name
        `;
        
        const [mechanics] = await db.query(query);
        res.json(mechanics);
        
    } catch (err) {
        console.error('❌ Error fetching mechanics stats:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch mechanics stats' 
        });
    }
});

// 8. GET appointments by date range
app.get('/api/appointments-by-date', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide start_date and end_date query parameters'
            });
        }

        const query = `
            SELECT a.*, m.name as mechanic_name 
            FROM appointments a 
            JOIN mechanics m ON a.mechanic_id = m.id
            WHERE a.appointment_date BETWEEN ? AND ?
            ORDER BY a.appointment_date DESC
        `;
        
        const [appointments] = await db.query(query, [start_date, end_date]);
        
        res.json({
            success: true,
            count: appointments.length,
            appointments
        });
        
    } catch (err) {
        console.error('❌ Error fetching appointments by date:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch appointments' 
        });
    }
});

// 9. Test endpoint
app.get('/api/test', async (req, res) => {
    try {
        // Test database connection
        await db.query('SELECT 1');
        
        res.json({
            status: 'Server is running',
            database: 'Connected to car_workshop_db',
            time: new Date().toISOString()
        });
        
    } catch (err) {
        res.status(500).json({
            status: 'Server error',
            error: err.message
        });
    }
});

// 10. Serve HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const startServer = async () => {
    try {
        await initializeDB();
        
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log('='.repeat(50));
            console.log('📡 API Endpoints:');
            console.log(`   GET    /api/mechanics`);
            console.log(`   POST   /api/book-appointment`);
            console.log(`   GET    /api/admin/appointments`);
            console.log(`   GET    /api/appointments/:id`);
            console.log(`   PUT    /api/appointments/:id`);
            console.log(`   DELETE /api/appointments/:id`);
            console.log(`   GET    /api/mechanics-with-stats`);
            console.log(`   GET    /api/appointments-by-date`);
            console.log(`   GET    /api/test`);
            console.log('='.repeat(50));
            console.log('💡 Open browser and visit: http://localhost:8000');
            console.log('='.repeat(50));
        });
        
    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        process.exit(1);
    }
};

startServer();