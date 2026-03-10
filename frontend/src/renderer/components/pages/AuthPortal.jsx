import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ArrowRight, ChevronDown, GraduationCap, Lock, Mail, School, UserCircle2, Check, Eye, EyeOff } from 'lucide-react';
import WindowControls from '../layout/WindowControls';

const DISTRICTS_TN = [
    'Ariyalur',
    'Chengalpattu',
    'Chennai',
    'Coimbatore',
    'Cuddalore',
    'Dharmapuri',
    'Dindigul',
    'Erode',
    'Kallakurichi',
    'Kancheepuram',
    'Kanniyakumari',
    'Karur',
    'Krishnagiri',
    'Madurai',
    'Mayiladuthurai',
    'Nagapattinam',
    'Namakkal',
    'Nilgiris',
    'Perambalur',
    'Pudukkottai',
    'Ramanathapuram',
    'Ranipet',
    'Salem',
    'Sivaganga',
    'Tenkasi',
    'Thanjavur',
    'Theni',
    'Thoothukudi',
    'Tiruchirappalli',
    'Tirunelveli',
    'Tirupathur',
    'Tiruppur',
    'Tiruvallur',
    'Tiruvannamalai',
    'Tiruvarur',
    'Vellore',
    'Viluppuram',
    'Virudhunagar',
];

const COLLEGES_TN = [
    // Ariyalur
    { name: 'Ariyalur Engineering College', abbr: 'AEC', district: 'Ariyalur' },
    { name: 'Government Arts and Science College, Ariyalur', abbr: 'GASC-ARL', district: 'Ariyalur' },
    { name: 'Government Polytechnic College, Jayankondam', abbr: 'GPC-JKM', district: 'Ariyalur' },
    { name: 'Indra Ganesan College of Engineering, Trichy (Ariyalur border)', abbr: 'IGCE', district: 'Ariyalur' },
    { name: 'Jayaram College of Engineering and Technology, Pagalavadi', abbr: 'JCET', district: 'Ariyalur' },
    // Chengalpattu
    { name: 'Chengalpattu Medical College and Hospital', abbr: 'CMCH', district: 'Chengalpattu' },
    { name: 'Jaya Engineering College, Thiruninravur', abbr: 'JEC', district: 'Chengalpattu' },
    { name: 'Madras Institute of Technology, Chrompet', abbr: 'MIT', district: 'Chengalpattu' },
    { name: 'Rajalakshmi Engineering College, Thandalam', abbr: 'REC', district: 'Chengalpattu' },
    { name: 'Sri Sivasubramaniya Nadar College of Engineering, Kalavakkam', abbr: 'SSNCE', district: 'Chengalpattu' },
    { name: 'Sri Venkateswara College of Engineering, Sriperumbudur', abbr: 'SVCE', district: 'Chengalpattu' },
    { name: "St. Joseph's College of Engineering, Semmenchery", abbr: 'SJCE', district: 'Chengalpattu' },
    { name: 'Vel Tech Rangarajan Dr. Sagunthala R&D Institute of Science and Technology', abbr: 'VELTECH', district: 'Chengalpattu' },

    // Chennai
    { name: 'Anna University (College of Engineering, Guindy)', abbr: 'AU-CEG', district: 'Chennai' },
    { name: 'B.S. Abdur Rahman Crescent Institute of Science and Technology', abbr: 'BSAU', district: 'Chennai' },
    { name: 'Dr. Ambedkar Government Arts College', abbr: 'DAGAC', district: 'Chennai' },
    { name: 'Ethiraj College for Women', abbr: 'ECW', district: 'Chennai' },
    { name: 'Indian Institute of Technology Madras', abbr: 'IITM', district: 'Chennai' },
    { name: 'Loyola College', abbr: 'Loyola', district: 'Chennai' },
    { name: 'Madras Christian College', abbr: 'MCC', district: 'Chennai' },
    { name: 'Madras Medical College', abbr: 'MMC', district: 'Chennai' },
    { name: 'Meenakshi Ammal Dental College and Hospital', abbr: 'MADCH', district: 'Chennai' },
    { name: 'Presidency College', abbr: 'PC', district: 'Chennai' },
    { name: "Queen Mary's College", abbr: 'QMC', district: 'Chennai' },
    { name: 'Sathyabama Institute of Science and Technology', abbr: 'SIST', district: 'Chennai' },
    { name: 'Saveetha Engineering College', abbr: 'SEC', district: 'Chennai' },
    { name: 'SRM Institute of Science and Technology, Kattankulathur', abbr: 'SRMIST', district: 'Chennai' },
    { name: 'SSN College of Engineering', abbr: 'SSN', district: 'Chennai' },
    { name: 'Stanley Medical College', abbr: 'SMC', district: 'Chennai' },
    { name: 'Stella Maris College', abbr: 'StellaMaris', district: 'Chennai' },
    { name: 'University of Madras', abbr: 'UOM', district: 'Chennai' },
    { name: 'Velammal Engineering College', abbr: 'VEC', district: 'Chennai' },

    // Coimbatore
    { name: 'Amrita School of Engineering, Coimbatore', abbr: 'ASE', district: 'Coimbatore' },
    { name: 'Avinashilingam Institute for Home Science and Higher Education for Women', abbr: 'AHW', district: 'Coimbatore' },
    { name: 'Bharathiar University', abbr: 'BU', district: 'Coimbatore' },
    { name: 'Coimbatore Institute of Technology', abbr: 'CIT', district: 'Coimbatore' },
    { name: 'Coimbatore Medical College', abbr: 'CMC', district: 'Coimbatore' },
    { name: 'Government Arts College (Autonomous), Coimbatore', abbr: 'GAC-CBE', district: 'Coimbatore' },
    { name: 'Government College of Technology, Coimbatore', abbr: 'GCT', district: 'Coimbatore' },
    { name: 'Hindusthan College of Engineering and Technology', abbr: 'HCET', district: 'Coimbatore' },
    { name: 'Karpagam Academy of Higher Education', abbr: 'KAHE', district: 'Coimbatore' },
    { name: 'Kumaraguru College of Technology', abbr: 'KCT', district: 'Coimbatore' },
    { name: 'Nehru Institute of Technology', abbr: 'NIT-CBE', district: 'Coimbatore' },
    { name: 'PSG College of Arts and Science', abbr: 'PSGCAS', district: 'Coimbatore' },
    { name: 'PSG College of Technology', abbr: 'PSGTECH', district: 'Coimbatore' },
    { name: 'Sri Krishna College of Engineering and Technology', abbr: 'SKCET', district: 'Coimbatore' },
    { name: 'Tamil Nadu Agricultural University', abbr: 'TNAU', district: 'Coimbatore' },

    // Cuddalore
    { name: 'Annamalai University, Chidambaram', abbr: 'AU-CUD', district: 'Cuddalore' },
    { name: 'Government Arts College, C. Mutlur, Chidambaram', abbr: 'GAC-CUD', district: 'Cuddalore' },
    { name: 'Mailam Engineering College, Mailam', abbr: 'MEC', district: 'Cuddalore' },
    { name: 'Periyar Arts College (Government), Devanampattinum', abbr: 'PAC', district: 'Cuddalore' },
    { name: 'Rajiv Gandhi Government Arts and Science College, Pennalurpet', abbr: 'RGGASC', district: 'Cuddalore' },

    // Dharmapuri
    { name: 'Government Arts College for Men, Dharmapuri', abbr: 'GACM-DHP', district: 'Dharmapuri' },
    { name: 'Government College of Engineering, Dharmapuri', abbr: 'GCE-DHP', district: 'Dharmapuri' },
    { name: 'Government Polytechnic College, Boomandahalli, Dharmapuri', abbr: 'GPC-DHP', district: 'Dharmapuri' },
    { name: 'Sun Arts and Science College, Dharmapuri', abbr: 'SASC-DHP', district: 'Dharmapuri' },

    // Dindigul
    { name: 'Dindigul Arts and Science College', abbr: 'DASC', district: 'Dindigul' },
    { name: 'Government Arts College for Women, Dindigul', abbr: 'GACW-DGL', district: 'Dindigul' },
    { name: "Mother Teresa Women's University", abbr: 'MTWU', district: 'Dindigul' },
    { name: 'P.S.N.A. College of Engineering and Technology, Dindigul', abbr: 'PSNACET', district: 'Dindigul' },

    // Erode
    { name: 'Bannari Amman Institute of Technology, Sathyamangalam', abbr: 'BIT-ERD', district: 'Erode' },
    { name: 'Erode Arts and Science College', abbr: 'EASC', district: 'Erode' },
    { name: 'Government Arts and Science College, Erode', abbr: 'GASC-ERD', district: 'Erode' },
    { name: 'Government College of Engineering, Erode', abbr: 'GCE-ERD', district: 'Erode' },
    { name: 'Government Medical College, Erode', abbr: 'GMC-ERD', district: 'Erode' },
    { name: 'Info Institute of Engineering, Erode', abbr: 'IIE', district: 'Erode' },
    { name: 'Nandha College of Technology, Erode', abbr: 'NCT-ERD', district: 'Erode' },
    { name: 'Velalar College of Engineering and Technology, Erode', abbr: 'VCET-ERD', district: 'Erode' },

    // Kallakurichi
    { name: 'Government Arts and Science College, Kallakurichi', abbr: 'GASC-KLK', district: 'Kallakurichi' },
    { name: 'Government Engineering College, Kallakurichi', abbr: 'GEC-KLK', district: 'Kallakurichi' },
    { name: 'Thiruvalluvar University, Vellore (Kallakurichi affiliate)', abbr: 'TVU-KLK', district: 'Kallakurichi' },

    // Kancheepuram
    { name: 'Government Engineering College, Sriperumbudur', abbr: 'GEC-KCP', district: 'Kancheepuram' },
    { name: 'Karpaga Vinayaga College of Engineering and Technology, Maduranthakam', abbr: 'KVCET', district: 'Kancheepuram' },
    { name: 'Meenakshi College of Engineering', abbr: 'MCE', district: 'Kancheepuram' },
    { name: 'Panimalar Engineering College, Poonamallee', abbr: 'PEC', district: 'Kancheepuram' },
    { name: 'Saveetha Medical College, Thandalam', abbr: 'SAVMC', district: 'Kancheepuram' },
    { name: 'Sri Venkateswara College of Engineering, Sriperumbudur', abbr: 'SVCE-KCP', district: 'Kancheepuram' },
    { name: 'Vels Institute of Science, Technology and Advanced Studies', abbr: 'VISTAS', district: 'Kancheepuram' },

    // Kanniyakumari
    { name: 'Cape Institute of Technology, Levengipuram', abbr: 'CIT-KK', district: 'Kanniyakumari' },
    { name: 'Government Arts and Science College, Nagercoil', abbr: 'GASC-KK', district: 'Kanniyakumari' },
    { name: 'Government Medical College, Nagercoil', abbr: 'GMC-KK', district: 'Kanniyakumari' },
    { name: 'Infant Jesus College of Engineering, Thoothoor', abbr: 'IJCE', district: 'Kanniyakumari' },
    { name: 'Noorul Islam Centre for Higher Education, Kumaracoil', abbr: 'NICHE', district: 'Kanniyakumari' },
    { name: 'Scott Christian College (Autonomous), Nagercoil', abbr: 'SCC', district: 'Kanniyakumari' },

    // Karur
    { name: 'Government Arts College, Karur', abbr: 'GAC-KRR', district: 'Karur' },
    { name: 'Government College of Engineering, Karur', abbr: 'GCE-KRR', district: 'Karur' },
    { name: 'Government Polytechnic College, Karur', abbr: 'GPC-KRR', district: 'Karur' },
    { name: 'Karur College of Engineering', abbr: 'KCE', district: 'Karur' },

    // Krishnagiri
    { name: 'Government Arts College for Men, Krishnagiri', abbr: 'GACM-KRG', district: 'Krishnagiri' },
    { name: 'Government College of Engineering, Bargur, Krishnagiri', abbr: 'GCE-KRG', district: 'Krishnagiri' },
    { name: 'Government Medical College, Krishnagiri', abbr: 'GMC-KRG', district: 'Krishnagiri' },
    { name: 'Hosur Institute of Technology and Science', abbr: 'HITS', district: 'Krishnagiri' },
    { name: 'Park College of Engineering and Technology, Kaniyur', abbr: 'PCET', district: 'Krishnagiri' },

    // Madurai
    { name: 'American College (Autonomous), Madurai', abbr: 'ACM', district: 'Madurai' },
    { name: 'Government College of Engineering, Madurai', abbr: 'GCE-MDU', district: 'Madurai' },
    { name: 'Madurai Medical College (Government)', abbr: 'MMC-MDU', district: 'Madurai' },
    { name: 'Lady Doak College, Madurai', abbr: 'LDC', district: 'Madurai' },
    { name: 'Madurai Kamaraj University', abbr: 'MKU', district: 'Madurai' },
    { name: 'Madura College (Autonomous)', abbr: 'MaduraC', district: 'Madurai' },
    { name: 'Thiagarajar College of Engineering, Madurai', abbr: 'TCE', district: 'Madurai' },

    // Mayiladuthurai
    { name: 'Government Arts and Science College, Mayiladuthurai', abbr: 'GASC-MYL', district: 'Mayiladuthurai' },
    { name: 'Government College of Engineering, Mayiladuthurai', abbr: 'GCE-MYL', district: 'Mayiladuthurai' },
    { name: 'Mayiladuthurai Institute of Technology', abbr: 'MIT-MYL', district: 'Mayiladuthurai' },
    { name: 'Swami Dayananda College of Arts and Science, Manjakkudi', abbr: 'SDCAS', district: 'Mayiladuthurai' },

    // Nagapattinam
    { name: 'Government Arts and Science College, Nagapattinam', abbr: 'GASC-NGP', district: 'Nagapattinam' },
    { name: 'Government College of Engineering, Nagapattinam', abbr: 'GCE-NGP', district: 'Nagapattinam' },
    { name: 'Nagapattinam College of Arts and Science', abbr: 'NCAS', district: 'Nagapattinam' },
    { name: 'Tamil Nadu Dr. J. Jayalalithaa Fisheries University', abbr: 'TNJFU', district: 'Nagapattinam' },

    // Namakkal
    { name: 'Excel Engineering College, Komarapalayam', abbr: 'ExcelEC-NMK', district: 'Namakkal' },
    { name: 'Government Arts and Science College, Namakkal', abbr: 'GASC-NMK', district: 'Namakkal' },
    { name: 'J.K.K. Nattraja College of Engineering and Technology, Kumarapalayam', abbr: 'JKKNCET', district: 'Namakkal' },
    { name: 'Paavai Engineering College, Namakkal', abbr: 'PavaiEC', district: 'Namakkal' },
    { name: 'Periyar University College of Arts and Science, Idappadi', abbr: 'PUCAS', district: 'Namakkal' },
    { name: 'Selvam College of Technology, Namakkal', abbr: 'SCT-NMK', district: 'Namakkal' },

    // Nilgiris
    { name: 'Government Arts College, Udhagamandalam (Ooty)', abbr: 'GAC-OOT', district: 'Nilgiris' },
    { name: 'Government College of Engineering, Gudalur', abbr: 'GCE-NLG', district: 'Nilgiris' },
    { name: 'Udhagamandalam Engineering College', abbr: 'UEC', district: 'Nilgiris' },

    // Perambalur
    { name: 'Government Arts and Science College, Perambalur', abbr: 'GASC-PBR', district: 'Perambalur' },
    { name: 'Government Polytechnic College, Perambalur', abbr: 'GPC-PBR', district: 'Perambalur' },
    { name: 'Roever College of Engineering and Technology, Perambalur', abbr: 'RCET', district: 'Perambalur' },
    { name: 'Roever Engineering College, Perambalur', abbr: 'RoeverEC-PBR', district: 'Perambalur' },

    // Pudukkottai
    { name: 'Alagappa University, Karaikudi', abbr: 'AU-KRK', district: 'Pudukkottai' },
    { name: 'Government Arts College, Aruppukottai', abbr: 'GAC-PDK', district: 'Pudukkottai' },
    { name: 'Government College of Engineering, Pudukkottai', abbr: 'GCE-PDK', district: 'Pudukkottai' },
    { name: 'Government Polytechnic College, Aranthangi', abbr: 'GPC-PDK', district: 'Pudukkottai' },

    // Ramanathapuram
    { name: 'Government Arts and Science College, Ramanathapuram', abbr: 'GASC-RMD', district: 'Ramanathapuram' },
    { name: 'Government College of Engineering, Ramanathapuram', abbr: 'GCE-RMD', district: 'Ramanathapuram' },
    { name: 'Mohamed Sathak A.J. College of Engineering', abbr: 'MSAJCE', district: 'Ramanathapuram' },
    { name: 'Syed Ammal Engineering College, Ramanathapuram', abbr: 'SAEC-RMD', district: 'Ramanathapuram' },

    // Ranipet
    { name: 'Government Arts and Science College, Ranipet', abbr: 'GASC-RNP', district: 'Ranipet' },
    { name: 'Government College of Engineering, Sriperumbudur (Ranipet)', abbr: 'GCE-RNP', district: 'Ranipet' },
    { name: 'Priyadarshini Engineering College, Vaniyambadi', abbr: 'PriyaEC', district: 'Ranipet' },

    // Salem
    { name: 'AVS College of Arts and Science, Salem', abbr: 'AVSCAS', district: 'Salem' },
    { name: 'Government Arts College (Autonomous), Salem', abbr: 'GAC-SLM', district: 'Salem' },
    { name: 'Government Arts College for Women, Salem', abbr: 'GACW-SLM', district: 'Salem' },
    { name: 'Government College of Engineering, Salem (Autonomous)', abbr: 'GCE-SLM', district: 'Salem' },
    { name: 'Government Medical College, Salem', abbr: 'GMC-SLM', district: 'Salem' },
    { name: 'Periyar University, Salem', abbr: 'PU-SLM', district: 'Salem' },
    { name: 'Salem College (Autonomous) for Women', abbr: 'SalemCW', district: 'Salem' },
    { name: "Vinayaka Mission's Kirupananda Variyar Engineering College, Salem", abbr: 'VMKVEC-SLM', district: 'Salem' },

    // Sivaganga
    { name: 'A.C. College of Engineering and Technology, Karaikudi', abbr: 'ACCET', district: 'Sivaganga' },
    { name: 'Government Arts College, Karaikudi', abbr: 'GAC-SVG', district: 'Sivaganga' },
    { name: 'Madurai Kamaraj University College, Sivaganga', abbr: 'MKUC-SVG', district: 'Sivaganga' },
    { name: 'Sethu Institute of Technology, Kariapatti', abbr: 'SIT-SVG', district: 'Sivaganga' },

    // Tenkasi
    { name: 'Government Arts and Science College, Tenkasi', abbr: 'GASC-TKS', district: 'Tenkasi' },
    { name: 'Government College of Engineering, Tirunelveli (Tenkasi region)', abbr: 'GCE-TKS', district: 'Tenkasi' },
    { name: 'Kalasalingam Academy of Research and Education, Krishnankovil', abbr: 'KARE-TKS', district: 'Tenkasi' },

    // Thanjavur
    { name: 'Government Arts and Science College, Kumbakonam', abbr: 'GASC-TNJ', district: 'Thanjavur' },
    { name: 'Government Medical College, Thanjavur', abbr: 'GMC-TNJ', district: 'Thanjavur' },
    { name: 'Rajah Serfoji Government College (Autonomous), Thanjavur', abbr: 'RSGC', district: 'Thanjavur' },
    { name: 'Saraswathi Velu College of Engineering', abbr: 'SVCE-TNJ', district: 'Thanjavur' },
    { name: 'Shanmugha Arts, Science, Technology and Research Academy (SASTRA)', abbr: 'SASTRA', district: 'Thanjavur' },
    { name: 'Tamil University, Thanjavur', abbr: 'TamilU', district: 'Thanjavur' },

    // Theni
    { name: 'Government Arts and Science College, Theni', abbr: 'GASC-THN', district: 'Theni' },
    { name: 'Government College of Engineering, Theni', abbr: 'GCE-THN', district: 'Theni' },
    { name: 'Theni Kammavar Sangam College of Technology', abbr: 'TKSCT', district: 'Theni' },

    // Thoothukudi
    { name: 'Govindammal Aditanar College for Women, Tiruchendur', abbr: 'GACW-TUT', district: 'Thoothukudi' },
    { name: 'Sardar Raja College of Engineering, Alangulam', abbr: 'SRCE', district: 'Thoothukudi' },
    { name: 'Thoothukudi Medical College and Hospital', abbr: 'TMCH', district: 'Thoothukudi' },
    { name: 'V.O. Chidambaram College (Autonomous), Thoothukudi', abbr: 'VOCC', district: 'Thoothukudi' },

    // Tiruchirappalli
    { name: 'Bharathidasan University', abbr: 'BDU', district: 'Tiruchirappalli' },
    { name: 'Bishop Heber College (Autonomous), Tiruchirappalli', abbr: 'BHC', district: 'Tiruchirappalli' },
    { name: 'Government College of Engineering, Srirangam', abbr: 'GCE-TCY', district: 'Tiruchirappalli' },
    { name: 'Jamal Mohamed College (Autonomous), Tiruchirappalli', abbr: 'JMC', district: 'Tiruchirappalli' },
    { name: 'National Institute of Technology, Tiruchirappalli', abbr: 'NIT-T', district: 'Tiruchirappalli' },
    { name: 'Saranathan College of Engineering', abbr: 'SCE-TCY', district: 'Tiruchirappalli' },
    { name: "St. Joseph's College (Autonomous), Tiruchirappalli", abbr: 'SJC-TCY', district: 'Tiruchirappalli' },
    { name: 'Tiruchirappalli Medical College and Hospital', abbr: 'TMCH-TCY', district: 'Tiruchirappalli' },
    { name: 'Trichy Engineering College', abbr: 'TEC-TCY', district: 'Tiruchirappalli' },

    // Tirunelveli
    { name: 'Francis Xavier Engineering College, Tirunelveli', abbr: 'FXEC-TVL', district: 'Tirunelveli' },
    { name: 'Government College of Engineering, Tirunelveli', abbr: 'GCE-TVL', district: 'Tirunelveli' },
    { name: 'Government Medical College, Tirunelveli', abbr: 'GMC-TVL', district: 'Tirunelveli' },
    { name: 'Manonmaniam Sundaranar University', abbr: 'MSU-TVL', district: 'Tirunelveli' },
    { name: 'Rani Anna Government College for Women, Tirunelveli', abbr: 'RAGCW', district: 'Tirunelveli' },
    { name: "St. Xavier's College (Autonomous), Palayamkottai", abbr: 'SXC', district: 'Tirunelveli' },
    { name: 'Tirunelveli Medical College and Hospital', abbr: 'TNMC', district: 'Tirunelveli' },

    // Tirupathur
    { name: 'Government Arts and Science College, Tirupattur', abbr: 'GASC-TPT', district: 'Tirupathur' },
    { name: 'Government College of Engineering, Thirupattur', abbr: 'GCE-TPT', district: 'Tirupathur' },
    { name: 'Priyadarshini Engineering College, Vaniyambadi', abbr: 'PriyaEC-TPT', district: 'Tirupathur' },

    // Tiruppur
    { name: 'Government Arts and Science College, Tiruppur', abbr: 'GASC-TPR', district: 'Tiruppur' },
    { name: 'Government College of Engineering, Tiruppur', abbr: 'GCE-TPR', district: 'Tiruppur' },
    { name: 'Park College of Engineering and Technology, Kaniyur (Tiruppur)', abbr: 'PCET-TPR', district: 'Tiruppur' },
    { name: 'Sri Ramakrishna Institute of Technology, Coimbatore (Tiruppur)', abbr: 'SRIT', district: 'Tiruppur' },

    // Tiruvallur
    { name: 'Government Arts and Science College, Thiruvallur', abbr: 'GASC-TVR', district: 'Tiruvallur' },
    { name: 'Jaya Engineering College, Thiruninravur', abbr: 'JEC-TVR', district: 'Tiruvallur' },
    { name: 'Panimalar Institute of Technology, Poonamallee', abbr: 'PIT', district: 'Tiruvallur' },
    { name: 'Saveetha Engineering College, Thandalam', abbr: 'SEC-TVR', district: 'Tiruvallur' },
    { name: 'Sri Sairam Engineering College, Tambaram', abbr: 'SSEC', district: 'Tiruvallur' },

    // Tiruvannamalai
    { name: 'Arunai Engineering College, Tiruvannamalai', abbr: 'ArunaiEC', district: 'Tiruvannamalai' },
    { name: 'Government Arts and Science College, Tiruvannamalai', abbr: 'GASC-TVN', district: 'Tiruvannamalai' },
    { name: 'Government College of Engineering, Tiruvannamalai', abbr: 'GCE-TVN', district: 'Tiruvannamalai' },
    { name: 'Mailam Engineering College, Villupuram (Tiruvannamalai region)', abbr: 'MEC-TVN', district: 'Tiruvannamalai' },

    // Tiruvarur
    { name: 'Central University of Tamil Nadu, Neelakudi', abbr: 'CUTN', district: 'Tiruvarur' },
    { name: 'Government Arts and Science College, Papanasam', abbr: 'GASC-TVR2', district: 'Tiruvarur' },
    { name: 'Government Polytechnic, Thiruthuraipoondi', abbr: 'GPC-TVR2', district: 'Tiruvarur' },

    // Vellore
    { name: 'Christian Medical College, Vellore', abbr: 'CMC-VLR', district: 'Vellore' },
    { name: 'Government Arts College (Autonomous), Vellore', abbr: 'GAC-VLR', district: 'Vellore' },
    { name: 'Government Medical College, Vellore', abbr: 'GMC-VLR', district: 'Vellore' },
    { name: 'Thiruvalluvar University', abbr: 'TVU-VLR', district: 'Vellore' },
    { name: 'Vellore Institute of Technology (VIT)', abbr: 'VIT', district: 'Vellore' },
    { name: 'Voorhees College (Autonomous), Vellore', abbr: 'VC-VLR', district: 'Vellore' },

    // Viluppuram
    { name: 'Government College of Engineering, Viluppuram', abbr: 'GCE-VLP', district: 'Viluppuram' },
    { name: 'Mailam Engineering College, Mailam', abbr: 'MEC-VLP', district: 'Viluppuram' },
    { name: 'Rajiv Gandhi Government Arts and Science College, Pennalurpet', abbr: 'RGGASC-VLP', district: 'Viluppuram' },
    { name: 'Thiruvalluvar Government Arts College, Rasipuram (Viluppuram region)', abbr: 'TGAC-VLP', district: 'Viluppuram' },

    // Virudhunagar
    { name: 'Kamaraj College of Engineering and Technology, Virudhunagar', abbr: 'KCET-VRD', district: 'Virudhunagar' },
    { name: 'Pasumpon Muthuramalingam Government Arts College, Paramakudi', abbr: 'PMGAC', district: 'Virudhunagar' },
    { name: 'Sethu Institute of Technology, Kariapatti', abbr: 'SIT-VRD', district: 'Virudhunagar' },
    { name: 'Sri Kaliswari College (Autonomous), Sivakasi', abbr: 'SKC', district: 'Virudhunagar' },
    { name: 'V.V. Vanniaperumal College for Women, Virudhunagar', abbr: 'VVCW', district: 'Virudhunagar' },
];

const DEGREE_OPTIONS = ['B.E', 'B.Tech', 'B.Sc', 'M.Sc', 'MBA', 'M.E', 'M.Tech', 'PhD'];

const COURSES_BY_DEGREE = {
    "B.E": [
        "Computer Science and Engineering",
        "Electronics and Communication Engineering",
        "Mechanical Engineering",
        "Electrical and Electronics Engineering",
        "Civil Engineering",
        "Information Technology",
        "Automobile Engineering",
        "Biomedical Engineering",
        "Mechatronics Engineering",
        "Aeronautical Engineering",
        "Production Engineering",
        "Electronics and Instrumentation Engineering",
        "Metallurgical Engineering",
        "Robotics and Automation",
        "Agriculture Engineering",
        "Marine Engineering",
        "Petrochemical Engineering",
        "Computer Science and Design",
        "Artificial Intelligence and Data Science",
        "Computer Engineering"
    ],
    "B.Tech": [
        "Artificial Intelligence and Data Science",
        "Information Technology",
        "Computer Science and Business Systems",
        "Biotechnology",
        "Chemical Engineering",
        "Food Technology",
        "Fashion Technology",
        "Textile Technology",
        "Artificial Intelligence and Machine Learning",
        "Cyber Security",
        "Internet of Things (IoT)",
        "Data Science",
        "Dairy Technology",
        "Polymer Technology",
        "Pharmaceutical Technology",
        "Agricultural Information Technology",
        "Nanotechnology",
        "Space Technology",
        "Geo-Informatics",
        "Cloud Computing and Virtualization"
    ],
    "B.Sc": [
        "Computer Science",
        "Information Technology",
        "Mathematics",
        "Physics",
        "Chemistry",
        "Botany",
        "Zoology",
        "Biotechnology",
        "Microbiology",
        "Data Science",
        "Artificial Intelligence",
        "Cyber Security",
        "Visual Communication",
        "Animation and Multimedia",
        "Hotel Management and Catering Science",
        "Electronics",
        "Biochemistry",
        "Statistics",
        "Geology",
        "Psychology"
    ],
    "M.Sc": [
        "Computer Science",
        "Information Technology",
        "Data Science",
        "Artificial Intelligence",
        "Physics",
        "Chemistry",
        "Mathematics",
        "Biotechnology",
        "Microbiology",
        "Bio-informatics",
        "Applied Electronics",
        "Software Engineering",
        "Cyber Security",
        "Actuarial Science",
        "Environmental Science",
        "Oceanography",
        "Geology",
        "Statistics",
        "Zoology",
        "Botany"
    ],
    "MBA": [
        "Finance",
        "Marketing",
        "Human Resource Management",
        "Operations Management",
        "Information Technology",
        "Business Analytics",
        "International Business",
        "Supply Chain Management",
        "Healthcare Management",
        "Hospitality Management",
        "Retail Management",
        "Agribusiness Management",
        "Entrepreneurship",
        "Aviation Management",
        "Tourism Management",
        "Media Management",
        "Banking and Insurance",
        "Project Management",
        "Logistics Management",
        "Digital Marketing"
    ],
    "M.E": [
        "Computer Science and Engineering",
        "Software Engineering",
        "Structural Engineering",
        "CAD/CAM",
        "Communication Systems",
        "Power Electronics and Drives",
        "VLSI Design",
        "Applied Electronics",
        "Thermal Engineering",
        "Manufacturing Engineering",
        "Environmental Engineering",
        "Industrial Engineering",
        "Engineering Design",
        "Embedded System Technologies",
        "Mechatronics",
        "Aeronautical Engineering",
        "Automobile Engineering",
        "Energy Engineering",
        "Biometrics and Cyber Security",
        "Construction Engineering"
    ],
    "M.Tech": [
        "Information Technology",
        "Artificial Intelligence and Machine Learning",
        "Data Science",
        "Cyber Security",
        "Biotechnology",
        "Chemical Engineering",
        "Nanotechnology",
        "Food Technology",
        "Textile Technology",
        "Remote Sensing",
        "Environmental Science and Technology",
        "Polymer Science and Engineering",
        "Energy Technology",
        "Industrial Safety Engineering",
        "Network Engineering",
        "Software Systems",
        "Internet of Things",
        "Cloud Computing",
        "Big Data Analytics",
        "Geo Informatics"
    ],
    "PhD": [
        "Computer Science and Engineering",
        "Information Technology",
        "Mechanical Engineering",
        "Electrical Engineering",
        "Electronics and Communication Engineering",
        "Civil Engineering",
        "Chemical Engineering",
        "Biotechnology",
        "Physics",
        "Chemistry",
        "Mathematics",
        "Management Studies",
        "English",
        "Economics",
        "Commerce",
        "Computer Applications",
        "Environmental Sciences",
        "Nanotechnology",
        "Data Science",
        "Artificial Intelligence"
    ]
};

function SelectField({ label, value, onChange, options, disabled = false, placeholder = 'Select' }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="block space-y-1.5" ref={dropdownRef}>
            <span className="block text-xs font-semibold tracking-wide text-slate-500 dark:text-dark-400 uppercase">{label}</span>
            <div className="relative">
                <div
                    onClick={(e) => {
                        e.preventDefault();
                        if (!disabled) setIsOpen(!isOpen);
                    }}
                    onKeyDown={(e) => {
                        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            setIsOpen(!isOpen);
                        }
                    }}
                    className={`w-full relative flex items-center rounded-xl border bg-slate-50 dark:bg-dark-950 px-3 py-2.5 pr-10 text-sm font-semibold transition-all focus-within:border-synapse-400 focus-within:ring-2 focus-within:ring-synapse-500/20 ${disabled ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-dark-700' : 'cursor-pointer border-slate-200 dark:border-dark-700'}`}
                >
                    <input
                        type="text"
                        readOnly
                        value={value || ''}
                        placeholder={placeholder}
                        disabled={disabled}
                        className={`w-full bg-transparent outline-none cursor-pointer text-slate-700 dark:text-dark-100 text-ellipsis ${value ? '' : 'placeholder-slate-400 dark:placeholder-dark-500'}`}
                    />
                    <ChevronDown
                        size={15}
                        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-dark-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>

                {isOpen && !disabled && (
                    <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-dark-950 border border-slate-200 dark:border-dark-700 rounded-xl shadow-lg shadow-black/5 dark:shadow-black/20 overflow-hidden py-1 max-h-60 overflow-y-auto scrollbar-thin">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-dark-800 ${!value ? 'text-synapse-600 dark:text-synapse-400 font-bold bg-slate-50 dark:bg-dark-900/50' : 'text-slate-600 dark:text-dark-300 font-medium'}`}
                        >
                            {placeholder}
                        </button>
                        {options.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-dark-800 ${value === opt ? 'text-synapse-600 dark:text-synapse-400 font-bold bg-slate-50 dark:bg-dark-900/50' : 'text-slate-700 dark:text-dark-100 font-medium'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function InputField({ label, value, onChange, type = 'text', placeholder = '' }) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
        <label className="block space-y-1.5">
            <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-dark-400 uppercase">{label}</span>
            <div className="relative">
                <input
                    type={inputType}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full rounded-xl border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-900 px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-dark-100 placeholder-slate-400 dark:placeholder-dark-500 outline-none focus:ring-2 focus:ring-synapse-500/30 ${isPassword ? 'pr-10' : ''}`}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-dark-400 dark:hover:text-dark-200 transition-colors"
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>
        </label>
    );
}

export default function AuthPortal({ onAuthSuccess }) {
    const [mode, setMode] = useState('signin');
    const [error, setError] = useState('');

    const [signinEmail, setSigninEmail] = useState('');
    const [signinPassword, setSigninPassword] = useState('');

    const [resetEmail, setResetEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [form, setForm] = useState({
        name: '',
        gender: '',
        phone: '',
        email: '',
        location: '',
        college: '',
        userType: 'Student',
        yearOfStudy: '',
        degree: '',
        course: '',
        password: '',
        confirmPassword: '',
    });

    const availableColleges = useMemo(() => {
        if (!form.location) return [];
        return COLLEGES_TN
            .filter((c) => c.district === form.location)
            .map((c) => `${c.name} (${c.abbr})`)
            .sort((a, b) => a.localeCompare(b));
    }, [form.location]);

    const availableCourses = useMemo(() => {
        if (!form.degree) return [];
        return COURSES_BY_DEGREE[form.degree] || [];
    }, [form.degree]);

    const yearOptions = useMemo(() => {
        if (form.userType === 'Alumni') {
            const currentYear = new Date().getFullYear();
            return Array.from({ length: 30 }, (_, i) => String(currentYear - i));
        }
        return ['1', '2', '3', '4', '5'];
    }, [form.userType]);

    const switchMode = (nextMode) => {
        if (nextMode === mode) return;
        setError('');
        setSuccessMsg('');
        setMode(nextMode);
    };

    function updateForm(field, value) {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'location') next.college = '';
            if (field === 'degree') next.course = '';
            if (field === 'userType') next.yearOfStudy = '';
            return next;
        });
    }

    function handleRegister(e) {
        e.preventDefault();
        setError('');

        const required = [
            'name', 'gender', 'phone', 'email', 'location',
            'college', 'userType', 'yearOfStudy', 'degree', 'course', 'password', 'confirmPassword'
        ];
        const missing = required.find((k) => !form[k]);
        if (missing) {
            setError('Please fill all required fields.');
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
        if (!emailOk) {
            setError('Please enter a valid email.');
            return;
        }

        localStorage.setItem('cortex-auth-profile', JSON.stringify(form));
        localStorage.setItem('cortex-auth-session', 'active');
        onAuthSuccess?.(form);
    }

    function handleSignIn(e) {
        e.preventDefault();
        setError('');

        if (!signinEmail || !signinPassword) {
            setError('Enter your email and password.');
            return;
        }

        if (!/@gmail\.com$/i.test(signinEmail.trim())) {
            setError('Sign in currently supports Gmail addresses only.');
            return;
        }

        const raw = localStorage.getItem('cortex-auth-profile');
        if (raw) {
            const profile = JSON.parse(raw);
            if (profile.email !== signinEmail || profile.password !== signinPassword) {
                setError('Invalid credentials. Try again or create account.');
                return;
            }
            localStorage.setItem('cortex-auth-session', 'active');
            onAuthSuccess?.(profile);
            return;
        }

        setError('No account found. Create your account first.');
    }

    function handleForgotPassword(e) {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!resetEmail) {
            setError('Please enter your email.');
            return;
        }

        const raw = localStorage.getItem('cortex-auth-profile');
        if (!raw) {
            setError('No account found. Create your account first.');
            return;
        }

        const profile = JSON.parse(raw);
        if (profile.email !== resetEmail) {
            setError('Email not found. Are you sure you used this email?');
            return;
        }

        alert(`[Industry Standard Flow Simulation]\n\nAn email has been "sent" to ${resetEmail} with a secure password reset link.\n\nClicking OK will simulate you clicking that link in your email inbox...`);
        switchMode('reset_password');
    }

    function handleResetPassword(e) {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!newPassword || !confirmPassword) {
            setError('Please fill in all fields.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const raw = localStorage.getItem('cortex-auth-profile');
        if (!raw) {
            setError('Session expired or account not found.');
            return;
        }

        const profile = JSON.parse(raw);
        profile.password = newPassword;
        localStorage.setItem('cortex-auth-profile', JSON.stringify(profile));

        setSigninEmail(profile.email);
        setSigninPassword('');
        setMode('reset_success');
    }

    return (
        <div className="min-h-screen w-full bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(14,116,144,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(21,128,61,0.2),transparent_30%),linear-gradient(180deg,#020617_0%,#0b1220_45%,#020617_100%)] flex items-center justify-center p-4">
            <div className="fixed top-0 right-0 z-[9999]" style={{ WebkitAppRegion: 'no-drag' }}>
                <WindowControls />
            </div>
            <div className="w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
                <section className="rounded-3xl border border-white/40 dark:border-dark-700/70 bg-white/70 dark:bg-dark-900/70 backdrop-blur-md shadow-2xl p-8 lg:p-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-synapse-50 text-synapse-700 dark:bg-synapse-900/40 dark:text-synapse-300 border border-synapse-200/60 dark:border-synapse-700/60">
                        <GraduationCap size={14} />
                        Cortex Student Network
                    </div>
                    <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-dark-50 leading-[1.05]">
                        Learn locally. Sync globally.
                    </h1>
                    <p className="mt-4 text-sm md:text-base text-slate-600 dark:text-dark-300 max-w-xl leading-relaxed">
                        Join Cortex with your student profile and unlock AI-powered study workflows, offline-first notes, and collaborative campus intelligence.
                    </p>

                    <div className="mt-8 grid sm:grid-cols-2 gap-4">
                        <div className="rounded-2xl p-4 bg-white/70 dark:bg-dark-800/80 border border-slate-200/70 dark:border-dark-700/70">
                            <p className="text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-dark-400">Profile Aware</p>
                            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-dark-100">Course-specific insights and campus context.</p>
                        </div>
                        <div className="rounded-2xl p-4 bg-white/70 dark:bg-dark-800/80 border border-slate-200/70 dark:border-dark-700/70">
                            <p className="text-xs uppercase tracking-widest font-bold text-slate-500 dark:text-dark-400">Secure Access</p>
                            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-dark-100">Your account and identity are protected by local auth flow.</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-white/40 dark:border-dark-700/70 bg-white/85 dark:bg-dark-900/85 backdrop-blur-md shadow-2xl p-6 md:p-7">
                    <div className="flex rounded-xl bg-slate-100 dark:bg-dark-800 p-1 mb-5">
                        <button
                            onClick={() => switchMode('signin')}
                            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${mode === 'signin' ? 'bg-white dark:bg-dark-700 text-synapse-600 dark:text-synapse-300 shadow-sm' : 'text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-dark-100'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => switchMode('register')}
                            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${mode === 'register' ? 'bg-white dark:bg-dark-700 text-synapse-600 dark:text-synapse-300 shadow-sm' : 'text-slate-500 dark:text-dark-400 hover:text-slate-800 dark:hover:text-dark-100'}`}
                        >
                            Create Account
                        </button>
                    </div>

                    {successMsg && (
                        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-semibold rounded-xl text-center">
                            {successMsg}
                        </div>
                    )}

                    <div key={mode} className="animate-fade-in [animation-duration:180ms] [transform:translateZ(0)] will-change-transform">
                        {mode === 'signin' && (
                            <form className="space-y-4" onSubmit={handleSignIn}>
                                <div className="flex items-center gap-2 text-slate-800 dark:text-dark-100 font-bold text-lg">
                                    <UserCircle2 size={18} />
                                    Welcome Back
                                </div>
                                <InputField label="Gmail" value={signinEmail} onChange={setSigninEmail} type="email" placeholder="yourname@gmail.com" />
                                <InputField label="Password" value={signinPassword} onChange={setSigninPassword} type="password" placeholder="Enter password" />

                                <div className="flex items-center justify-between text-sm">
                                    <button type="button" onClick={() => switchMode('forgot_password')} className="text-synapse-600 dark:text-synapse-300 font-semibold hover:underline">Forgot Password</button>
                                    <button
                                        type="button"
                                        className="text-slate-500 dark:text-dark-400 font-semibold hover:text-slate-800 dark:hover:text-dark-100"
                                        onClick={() => switchMode('register')}
                                    >
                                        New to Cortex? Create Account
                                    </button>
                                </div>

                                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                                <button type="submit" className="w-full rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors">
                                    Login <ArrowRight size={16} />
                                </button>
                            </form>
                        )}

                        {mode === 'register' && (
                            <form className="space-y-4 max-h-[72vh] overflow-y-auto pr-1 scrollbar-thin" onSubmit={handleRegister}>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <InputField label="Name" value={form.name} onChange={(v) => updateForm('name', v)} placeholder="Full name" />
                                    <SelectField label="Gender" value={form.gender} onChange={(v) => updateForm('gender', v)} options={['Male', 'Female', 'Other', 'Prefer not to say']} />
                                    <InputField label="Phone Number" value={form.phone} onChange={(v) => updateForm('phone', v)} placeholder="10-digit mobile" />
                                    <InputField label="Personal Email" value={form.email} onChange={(v) => updateForm('email', v)} type="email" placeholder="name@gmail.com" />
                                    <SelectField label="Location" value={form.location} onChange={(v) => updateForm('location', v)} options={DISTRICTS_TN} placeholder="Select district" />
                                    <SelectField label="College" value={form.college} onChange={(v) => updateForm('college', v)} options={availableColleges} disabled={!form.location} placeholder={form.location ? 'Select college' : 'Select location first'} />
                                    <SelectField label="Student / Alumni" value={form.userType} onChange={(v) => updateForm('userType', v)} options={['Student', 'Alumni']} />
                                    <SelectField label={form.userType === 'Alumni' ? 'Graduation Year' : 'Year of Study'} value={form.yearOfStudy} onChange={(v) => updateForm('yearOfStudy', v)} options={yearOptions} />
                                    <SelectField label="Degree" value={form.degree} onChange={(v) => updateForm('degree', v)} options={DEGREE_OPTIONS} placeholder="Select degree" />
                                    <SelectField label="Course" value={form.course} onChange={(v) => updateForm('course', v)} options={availableCourses} disabled={!form.degree} placeholder={form.degree ? 'Select course' : 'Select degree first'} />
                                    <InputField label="Password" value={form.password} onChange={(v) => updateForm('password', v)} type="password" placeholder="Create password" />
                                    <InputField label="Confirm Password" value={form.confirmPassword} onChange={(v) => updateForm('confirmPassword', v)} type="password" placeholder="Confirm password" />
                                </div>

                                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                                <button type="submit" className="w-full rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors">
                                    Create Account <ArrowRight size={16} />
                                </button>
                            </form>
                        )}

                        {mode === 'forgot_password' && (
                            <form className="space-y-4" onSubmit={handleForgotPassword}>
                                <div className="flex items-center gap-2 text-slate-800 dark:text-dark-100 font-bold text-lg mb-2">
                                    <Lock size={18} />
                                    Reset Password
                                </div>
                                <p className="text-sm text-slate-500 dark:text-dark-400">Enter your registered email address and we'll securely send you a link to reset your password.</p>

                                <InputField label="Registered Email" value={resetEmail} onChange={setResetEmail} type="email" placeholder="name@gmail.com" />

                                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                                <button type="submit" className="w-full mt-2 rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors">
                                    Send Reset Link <ArrowRight size={16} />
                                </button>

                                <div className="text-center mt-4 pt-2">
                                    <button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-dark-400 dark:hover:text-dark-100 transition-colors" onClick={() => switchMode('signin')}>
                                        Back to Sign In
                                    </button>
                                </div>
                            </form>
                        )}

                        {mode === 'reset_password' && (
                            <form className="space-y-4" onSubmit={handleResetPassword}>
                                <div className="flex items-center gap-2 text-slate-800 dark:text-dark-100 font-bold text-lg mb-2">
                                    <Lock size={18} />
                                    Create New Password
                                </div>
                                <p className="text-sm text-slate-500 dark:text-dark-400 mb-2">Enter your new secure password for Cortex.</p>

                                <InputField label="New Password" value={newPassword} onChange={setNewPassword} type="password" placeholder="Create new password" />
                                <InputField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Confirm new password" />

                                {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                                <button type="submit" className="w-full mt-4 rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors">
                                    Update Password <ArrowRight size={16} />
                                </button>
                            </form>
                        )}

                        {mode === 'reset_success' && (
                            <div className="text-center py-6 space-y-4">
                                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800/60 shadow-inner">
                                    <Check size={32} strokeWidth={3} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-dark-50 tracking-tight">Password Reset Complete</h2>
                                <p className="text-slate-500 dark:text-dark-400 max-w-sm mx-auto leading-relaxed">
                                    Your Cortex account password has been successfully updated in your local profile. You can now securely log in with your new credentials.
                                </p>
                                <button
                                    onClick={() => switchMode('signin')}
                                    className="mt-6 inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-synapse-600 hover:bg-synapse-700 text-white text-sm font-bold transition-colors shadow-sm"
                                >
                                    Click here to log in <ArrowRight size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-dark-700 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-slate-50 dark:bg-dark-800 p-2">
                            <Mail size={14} className="mx-auto mb-1 text-synapse-500" />
                            <p className="text-[11px] font-bold text-slate-600 dark:text-dark-300">Campus Email</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-dark-800 p-2">
                            <School size={14} className="mx-auto mb-1 text-synapse-500" />
                            <p className="text-[11px] font-bold text-slate-600 dark:text-dark-300">College Mapped</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 dark:bg-dark-800 p-2">
                            <Lock size={14} className="mx-auto mb-1 text-synapse-500" />
                            <p className="text-[11px] font-bold text-slate-600 dark:text-dark-300">Secure Access</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
