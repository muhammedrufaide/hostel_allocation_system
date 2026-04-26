// db-client.js
const API_URL = 'http://localhost:3000/api';

let students = [];
let rooms = [];
let allocations = [];

// DOM Elements
const studentTable = document.getElementById('student-table-body');
const roomTable = document.getElementById('room-table-body');
const allocationTable = document.getElementById('allocation-table-body');

const allocStudentSelect = document.getElementById('alloc-student');
const allocRoomSelect = document.getElementById('alloc-room');

// --- DATA FETCHING ---
async function fetchData() {
  try {
    const [stRes, rmRes, alRes] = await Promise.all([
      fetch(`${API_URL}/students`),
      fetch(`${API_URL}/rooms`),
      fetch(`${API_URL}/allocations`)
    ]);
    
    students = await stRes.json();
    rooms = await rmRes.json();
    allocations = await alRes.json();
    
    renderStudents();
    renderRooms();
    renderAllocations();
    populateAllocationDropdowns();
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// --- RENDER FUNCTIONS ---
function renderStudents() {
  studentTable.innerHTML = '';
  if (students.length === 0) return studentTable.innerHTML = '<tr><td colspan="4" class="empty-msg">No students registered.</td></tr>';
  
  students.forEach(st => {
    const statusClass = st.isAllocated ? 'active' : 'dormant';
    const statusText = st.isAllocated ? 'ALLOCATED' : 'PENDING';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-name">${st.rollNo}</td>
      <td>${st.name}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td class="cell-actions">
        <button class="action-btn delete-btn" onclick="deleteStudent('${st._id}')">DELETE</button>
      </td>
    `;
    studentTable.appendChild(tr);
  });
}

function renderRooms() {
  roomTable.innerHTML = '';
  if (rooms.length === 0) return roomTable.innerHTML = '<tr><td colspan="4" class="empty-msg">No rooms found.</td></tr>';
  
  rooms.forEach(rm => {
    const occupancyPercent = (rm.currentOccupancy / rm.capacity) * 100;
    const isFull = rm.currentOccupancy >= rm.capacity;
    const powerClass = isFull ? 'power-fill full' : 'power-fill';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-name">${rm.roomNumber}</td>
      <td>${rm.capacity} Beds</td>
      <td class="cell-power">
        <div class="power-bar">
          <div class="${powerClass}" style="width: ${occupancyPercent}%"></div>
        </div>
        ${rm.currentOccupancy} / ${rm.capacity}
      </td>
      <td class="cell-actions">
        <button class="action-btn delete-btn" onclick="deleteRoom('${rm._id}')">DELETE</button>
      </td>
    `;
    roomTable.appendChild(tr);
  });
}

function renderAllocations() {
  allocationTable.innerHTML = '';
  if (allocations.length === 0) return allocationTable.innerHTML = '<tr><td colspan="4" class="empty-msg">No active allocations.</td></tr>';
  
  allocations.forEach(al => {
    const studentName = al.studentId ? al.studentId.name : 'Unknown';
    const roomNo = al.roomId ? al.roomId.roomNumber : 'Unknown';
    const dateStr = new Date(al.allocatedAt).toLocaleDateString();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="cell-name">${studentName}</td>
      <td>Room ${roomNo}</td>
      <td>${dateStr}</td>
      <td class="cell-actions">
        <button class="action-btn delete-btn" onclick="vacateRoom('${al._id}')">VACATE</button>
      </td>
    `;
    allocationTable.appendChild(tr);
  });
}

function populateAllocationDropdowns() {
  allocStudentSelect.innerHTML = '<option value="" disabled selected>Select Unallocated Student</option>';
  allocRoomSelect.innerHTML = '<option value="" disabled selected>Select Available Room</option>';
  
  // Only show unallocated students
  students.filter(s => !s.isAllocated).forEach(s => {
    allocStudentSelect.innerHTML += `<option value="${s._id}">${s.name} (${s.rollNo})</option>`;
  });
  
  // Only show rooms with capacity
  rooms.filter(r => r.currentOccupancy < r.capacity).forEach(r => {
    allocRoomSelect.innerHTML += `<option value="${r._id}">Room ${r.roomNumber} (${r.capacity - r.currentOccupancy} left)</option>`;
  });
}

// --- FORM SUBMISSIONS ---
document.getElementById('student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById('student-name').value,
    rollNo: document.getElementById('student-roll').value,
    email: document.getElementById('student-email').value,
    contact: document.getElementById('student-contact').value
  };
  try {
    const res = await fetch(`${API_URL}/students`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
    if(!res.ok) { const err = await res.json(); throw new Error(err.error); }
    document.getElementById('student-form').reset();
    fetchData();
  } catch (err) { alert(err.message); }
});

document.getElementById('room-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    roomNumber: document.getElementById('room-number').value,
    capacity: parseInt(document.getElementById('room-capacity').value)
  };
  try {
    const res = await fetch(`${API_URL}/rooms`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
    if(!res.ok) { const err = await res.json(); throw new Error(err.error); }
    document.getElementById('room-form').reset();
    fetchData();
  } catch (err) { alert(err.message); }
});

document.getElementById('allocation-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    studentId: allocStudentSelect.value,
    roomId: allocRoomSelect.value
  };
  try {
    const res = await fetch(`${API_URL}/allocations`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
    if(!res.ok) { const err = await res.json(); throw new Error(err.error); }
    document.getElementById('allocation-form').reset();
    fetchData();
  } catch (err) { alert(err.message); }
});

// --- ACTIONS ---
window.deleteStudent = async (id) => {
  if(!confirm('Delete this student?')) return;
  const res = await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' });
  if(!res.ok) { const err = await res.json(); alert(err.error); }
  fetchData();
}

window.deleteRoom = async (id) => {
  if(!confirm('Delete this room?')) return;
  const res = await fetch(`${API_URL}/rooms/${id}`, { method: 'DELETE' });
  if(!res.ok) { const err = await res.json(); alert(err.error); }
  fetchData();
}

window.vacateRoom = async (id) => {
  if(!confirm('Vacate this room allocation?')) return;
  const res = await fetch(`${API_URL}/allocations/${id}`, { method: 'DELETE' });
  if(!res.ok) { const err = await res.json(); alert(err.error); }
  fetchData();
}

// Initial fetch
fetchData();
