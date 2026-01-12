// তারিখের লিমিট সেট করা (আজকের আগের তারিখ সিলেক্ট করা যাবে না)
const today = new Date().toISOString().split('T')[0];
const dateInput = document.getElementById('dateInput');
if(dateInput) dateInput.setAttribute('min', today);

// API Base URL - তোমার সার্ভার যদি ৮০০০ পোর্টে চলে তবে সরাসরি সেটা ব্যবহার করা ভালো
const API_BASE = 'http://localhost:8000';

// Section switching
function showSection(section) {
    const userSec = document.getElementById('user-section');
    const adminSec = document.getElementById('admin-section');
    const mechSec = document.getElementById('mechanics-section');

    if (section === 'user') {
        userSec.classList.remove('hidden');
        adminSec.classList.add('hidden');
        if(mechSec) mechSec.classList.remove('hidden');
    } else {
        userSec.classList.add('hidden');
        adminSec.classList.remove('hidden');
        if(mechSec) mechSec.classList.add('hidden');
        // অ্যাডমিন সেকশনে গেলেই ডাটা রিফ্রেশ হবে
        fetchAppointments();
    }
}

// Form submission (Appointment Booking)
document.getElementById('appointmentForm').onsubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const messageDiv = document.getElementById('message');
    messageDiv.style.display = 'none';
    
    try {
        messageDiv.innerText = 'Submitting appointment... / অ্যাপয়েন্টমেন্ট সাবমিট করা হচ্ছে...';
        messageDiv.className = 'message info'; // একটি নীল রঙের স্টাইল দিতে পারো
        messageDiv.style.display = 'block';
        
        const response = await fetch(`${API_BASE}/api/book-appointment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            messageDiv.innerText = '✅ ' + (result.message || 'Success!') + ' / আপনার অ্যাপয়েন্টমেন্ট সফলভাবে বুক হয়েছে!';
            messageDiv.className = 'message success';
            e.target.reset(); 
        } else {
            // সার্ভারের পাঠানো নির্দিষ্ট মেসেজ দেখানো (যেমন: "Mechanic is full")
            messageDiv.innerText = '⚠️ ' + result.message;
            messageDiv.className = 'message error';
        }
    } catch (err) {
        messageDiv.innerText = '❌ Error: Could not connect to server. / এরর: সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না।';
        messageDiv.className = 'message error';
        console.error('Submission error:', err);
    }
};



// fetching data : 

async function fetchAppointments() {
    const tbody = document.getElementById('appointmentTableBody');
    if(!tbody) return; // সেফটি চেক
    
    tbody.innerHTML = `<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE}/api/admin/appointments`);
        if (!response.ok) throw new Error('Failed to fetch');
        const appointments = await response.json();

        tbody.innerHTML = ''; // লোডিং টেক্সট ক্লিয়ার করা

        if (!appointments || appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No appointments found.</td></tr>';
            return;
        }

        appointments.forEach(app => {
            const date = new Date(app.appointment_date).toLocaleDateString('en-GB');

            // এখানে আমরা সরাসরি একটি স্ট্রিং (rowContent) তৈরি করছি
            const rowContent = `
                <tr>
                    <td><strong>${app.name}</strong><br><small>${app.address || ''}</small></td>
                    <td>${app.phone}</td>
                    <td>${app.license_no || 'N/A'}</td>
                    <td>${date}</td>
                    <td><span class="badge">${app.mechanic_name}</span></td>
                    <td>
                        <button class="edit-btn" onclick="editAppointment(${app.id}, '${app.name}', '${app.address || ""}', '${app.phone}', '${app.license_no}', '${app.engine_no}', '${app.appointment_date}', '${app.status}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>

                        <button class="delete-btn" onclick="deleteAppointment(${app.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
            // আপনার প্রিয় মেথড দিয়ে টেবিল বডিতে পুশ করা
            tbody.insertAdjacentHTML('beforeend', rowContent);
        });
    } catch (error) {
        console.error('Fetch error:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:red">Failed to load data.</td></tr>';
    }
}








// update : 



async function editAppointment(id, name, address, phone, license, engine, date) {
    const newMechanicId = prompt("Enter New Mechanic ID (1: John, 2: Bob, 3: Alex, 4: Hopper):");
    
    if (newMechanicId) {
        // তারিখটি ডাটাবেজের ফরম্যাটে (YYYY-MM-DD) নিয়ে আসা
        const formattedDate = new Date(date).toISOString().split('T')[0];

        try {
            const response = await fetch(`${API_BASE}/api/appointments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    address: address,
                    phone: phone,
                    license_no: license,
                    engine_no: engine,
                    appointment_date: formattedDate,
                    mechanic_id: parseInt(newMechanicId)
                    // status এখান থেকে সরিয়ে দিয়েছি
                })
            });

            const result = await response.json();
            if (result.success) {
                alert("✅ Appointment Updated!");
                fetchAppointments(); 
            } else {
                alert("❌ Update failed: " + result.message);
            }
        } catch (err) {
            console.error('Error:', err);
        }
    }
}












async function deleteAppointment(id) {
	// কনফার্মেশন বক্স
	const confirmDelete = confirm("Are you sure you want to delete this appointment?\nআপনি কি নিশ্চিত যে এই অ্যাপয়েন্টমেন্টটি মুছে ফেলতে চান?");
	
	if (!confirmDelete) return;

	try {
		// আপনার দেওয়া ব্যাকএন্ড এপিআই অনুযায়ী কল করা হচ্ছে
		const response = await fetch(`${API_BASE}/api/appointments/${id}`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		const result = await response.json();

		if (result.success) {
			// সফল হলে ইউজারকে জানানো এবং টেবিল রিফ্রেশ করা
			alert("✅ " + result.message);
			fetchAppointments(); // লিস্ট রিফ্রেশ
		} else {
			alert("❌ Error: " + result.message);
		}
	} catch (error) {
		console.error('Delete error:', error);
		alert("❌ Something went wrong! / কিছু একটা সমস্যা হয়েছে!");
	}
}




window.onload = fetchAppointments;






// Initial state
showSection('user');