const XLSX = require('xlsx');
const fs = require('fs');

fs.mkdirSync('templates', { recursive: true });

const rows = [
  [
    'exam_name',
    'exam_date',
    'session',
    'class_name',
    'roll_no',
    'registration_no',
    'student_name',
    'dob',
    'mobile',
    'marks',
    'status_text',
    'result_status',
  ],
  [
    'Samanya Gyan Pratiyogita',
    '2026-02-08',
    '2026',
    'Class 10',
    '101',
    'REG-0001',
    'Amit Kumar',
    '2008-04-12',
    '9000000001',
    '78',
    'pass',
    'published',
  ],
];

const worksheet = XLSX.utils.aoa_to_sheet(rows);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
XLSX.writeFile(workbook, 'templates/results_import_sample.xlsx');

console.log('Template created: templates/results_import_sample.xlsx');
