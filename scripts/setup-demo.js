/**
 * Cortex Demo Setup Script
 * Downloads BGE-small model and generates 100 synthetic academic documents with embeddings.
 * 
 * Usage: npm run setup-demo
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { initializeDatabase } = require('../src/services/database');
const { encryptText, encryptEmbedding } = require('../src/services/encryption');

const MODEL_DIR = path.join(__dirname, '..', 'models', 'bge-small-en-v1.5');
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'cortex.db');

// HuggingFace model files to download
const MODEL_FILES = [
    {
        url: 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/onnx/model.onnx',
        dest: 'model.onnx',
    },
    {
        url: 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/tokenizer.json',
        dest: 'tokenizer.json',
    },
    {
        url: 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/tokenizer_config.json',
        dest: 'tokenizer_config.json',
    },
];

// ── Academic Content Generator ────────────────────────────────────────────────

const SUBJECTS = {
    'Thermodynamics': [
        'The first law of thermodynamics states that energy cannot be created or destroyed, only transformed from one form to another. In a closed system, the total energy remains constant. This is also known as the law of conservation of energy.',
        'The second law of thermodynamics introduces the concept of entropy, stating that in any natural process, the total entropy of an isolated system always increases over time. Heat flows spontaneously from hot to cold objects.',
        'Entropy is a measure of the disorder or randomness in a thermodynamic system. As entropy increases, the energy available for useful work decreases. The universe tends toward maximum entropy.',
        'The Carnot cycle describes the most efficient possible heat engine operating between two temperature reservoirs. It consists of two isothermal and two adiabatic processes.',
        'Heat capacity is the amount of heat required to raise the temperature of a substance by one degree. Specific heat capacity is heat capacity per unit mass. Water has a high specific heat capacity of 4.186 J/g°C.',
        'An adiabatic process occurs without heat transfer between the system and surroundings. In adiabatic compression, work done on the gas increases its internal energy and temperature.',
        'Gibbs free energy (G = H - TS) determines whether a reaction occurs spontaneously. A negative change in Gibbs free energy indicates a spontaneous reaction at constant temperature and pressure.',
        'Phase transitions such as melting, boiling, and sublimation involve changes in enthalpy. The latent heat is the energy absorbed or released during a phase change without temperature change.',
        'The ideal gas law PV = nRT relates pressure, volume, temperature, and amount of gas. Real gases deviate from ideal behavior at high pressures and low temperatures.',
        'The third law of thermodynamics states that the entropy of a perfect crystal at absolute zero is exactly zero. This provides a reference point for measuring absolute entropy.',
    ],
    'Data Structures': [
        'A binary search tree (BST) is a data structure where each node has at most two children. The left subtree contains only nodes with keys less than the parent, and the right subtree contains only nodes with keys greater than the parent.',
        'Hash tables provide O(1) average-case time complexity for insertions, deletions, and lookups. Collisions are handled using techniques like chaining or open addressing.',
        'A linked list is a linear data structure where each element points to the next. Unlike arrays, linked lists allow efficient insertion and deletion at any position but lack random access.',
        'A stack is a Last-In-First-Out (LIFO) data structure. Common operations are push (add to top) and pop (remove from top). Stacks are used in function call management, expression evaluation, and backtracking.',
        'Graphs consist of vertices and edges. They can be directed or undirected, weighted or unweighted. Common traversal algorithms include breadth-first search (BFS) and depth-first search (DFS).',
        'A heap is a complete binary tree satisfying the heap property. In a max-heap, each parent is greater than its children. Heaps are used to implement priority queues efficiently.',
        'AVL trees are self-balancing binary search trees where the height difference between left and right subtrees is at most one. Rotations maintain balance after insertions and deletions.',
        'A queue is a First-In-First-Out (FIFO) data structure. Elements are added at the rear (enqueue) and removed from the front (dequeue). Used in BFS, job scheduling, and buffer management.',
        'A trie (prefix tree) is a tree-like data structure used for storing strings. Each node represents a character. Tries enable efficient prefix-based searches and autocomplete functionality.',
        'Red-black trees are self-balancing BSTs with an additional color property. Each node is red or black, and the tree satisfies constraints that ensure O(log n) operations.',
    ],
    'Linear Algebra': [
        'A matrix is a rectangular array of numbers arranged in rows and columns. Matrix multiplication is not commutative: AB ≠ BA in general. The identity matrix I acts as the multiplicative identity.',
        'Eigenvalues and eigenvectors are fundamental in linear algebra. For a matrix A, the eigenvector v satisfies Av = λv where λ is the eigenvalue. They are used in PCA, stability analysis, and quantum mechanics.',
        'The determinant of a matrix is a scalar that encodes important properties. A matrix is invertible if and only if its determinant is nonzero. The determinant also gives the scaling factor of the linear transformation.',
        'Gaussian elimination transforms a matrix into row echelon form using elementary row operations. It is used to solve systems of linear equations, compute matrix rank, and find determinants.',
        'A vector space is a set of vectors closed under addition and scalar multiplication. Common examples include Rⁿ, the set of polynomials, and function spaces.',
        'The dot product of two vectors a·b = |a||b|cos(θ) measures alignment. Orthogonal vectors have a dot product of zero. The dot product is used in projections and computing similarity.',
        'Singular Value Decomposition (SVD) factors a matrix M = UΣVᵀ where U and V are orthogonal and Σ is diagonal with singular values. SVD is used in dimensionality reduction and data compression.',
        'The rank of a matrix is the dimension of the column space. A full-rank square matrix is invertible. The rank-nullity theorem states: rank(A) + nullity(A) = number of columns.',
        'Linear transformations map vectors from one space to another while preserving addition and scalar multiplication. Every linear transformation can be represented by a matrix.',
        'The cross product of two 3D vectors produces a vector perpendicular to both input vectors. Its magnitude equals the area of the parallelogram spanned by the input vectors.',
    ],
    'Organic Chemistry': [
        'Alkanes are saturated hydrocarbons with single covalent bonds between carbon atoms. They follow the general formula CₙH₂ₙ₊₂. Methane (CH₄) is the simplest alkane.',
        'Functional groups determine the chemical properties of organic molecules. Common groups include hydroxyl (-OH), carboxyl (-COOH), amino (-NH₂), and carbonyl (C=O).',
        'Chirality refers to molecules that are non-superimposable mirror images of each other (enantiomers). A chiral center is a carbon atom bonded to four different groups. Chirality is crucial in pharmaceuticals.',
        'Nucleophilic substitution reactions (SN1 and SN2) involve the replacement of a leaving group by a nucleophile. SN2 is bimolecular with inversion, while SN1 is unimolecular with racemization.',
        'Aromaticity describes the stability of cyclic, planar molecules with delocalized π electrons following Hückel\'s rule (4n+2 π electrons). Benzene is the classic example of an aromatic compound.',
        'Electrophilic aromatic substitution is a key reaction of benzene. Substituents on the ring can be activating or deactivating and direct incoming groups to ortho/para or meta positions.',
        'Polymerization is the process of combining monomers to form polymers. Addition polymerization involves unsaturated monomers, while condensation polymerization releases a small molecule like water.',
        'Isomers are molecules with the same molecular formula but different structures. Structural isomers differ in connectivity, while stereoisomers differ in spatial arrangement.',
        'Alcohols are organic compounds containing the hydroxyl (-OH) group. They are classified as primary, secondary, or tertiary based on the carbon bearing the -OH group.',
        'Carbohydrates are polyhydroxyl aldehydes or ketones. Monosaccharides like glucose and fructose are the simplest sugars. They exist in cyclic forms (pyranose and furanose) in solution.',
    ],
    'Machine Learning': [
        'Supervised learning uses labeled data to train models that predict outputs for new inputs. Common algorithms include linear regression, logistic regression, decision trees, and neural networks.',
        'Gradient descent is an optimization algorithm that iteratively adjusts parameters to minimize a cost function. The learning rate controls step size. Variants include SGD, Adam, and RMSprop.',
        'Overfitting occurs when a model learns noise in the training data, leading to poor generalization. Regularization techniques like L1, L2, dropout, and early stopping help prevent overfitting.',
        'Convolutional neural networks (CNNs) use convolutional layers with learnable filters to extract spatial features from images. They are the foundation of modern computer vision.',
        'Recurrent neural networks (RNNs) process sequential data by maintaining hidden states. LSTM and GRU variants address the vanishing gradient problem, enabling learning of long-range dependencies.',
        'The bias-variance tradeoff describes the balance between model simplicity and complexity. High bias leads to underfitting, while high variance leads to overfitting.',
        'Principal Component Analysis (PCA) reduces dimensionality by projecting data onto orthogonal axes of maximum variance. It uses eigendecomposition of the covariance matrix.',
        'Random forests are ensemble methods that combine multiple decision trees trained on random subsets of data and features. They reduce overfitting compared to individual decision trees.',
        'K-means clustering is an unsupervised algorithm that partitions data into K clusters by minimizing within-cluster variance. It iteratively assigns points to nearest centroids and updates centroids.',
        'Transfer learning leverages pretrained models on large datasets to solve related tasks with limited data. It is widely used in NLP (BERT, GPT) and computer vision (ResNet, VGG).',
    ],
    'Quantum Mechanics': [
        'The Schrödinger equation is the fundamental equation of quantum mechanics. The time-independent form Ĥψ = Eψ determines the allowed energy levels and wavefunctions of a quantum system.',
        'The Heisenberg uncertainty principle states that certain pairs of physical properties, like position and momentum, cannot both be measured with arbitrary precision simultaneously: ΔxΔp ≥ ℏ/2.',
        'Wave-particle duality is the concept that quantum entities exhibit both wave and particle properties. The double-slit experiment demonstrates this duality for photons and electrons.',
        'Quantum entanglement occurs when particles become correlated such that the quantum state of one particle instantly influences the state of another, regardless of distance.',
        'The hydrogen atom has quantized energy levels given by Eₙ = -13.6/n² eV. Transitions between levels produce spectral lines. The Bohr model was the first to explain this quantization.',
        'Spin is an intrinsic angular momentum of quantum particles. Electrons have spin-1/2, meaning they can be spin-up (+ℏ/2) or spin-down (-ℏ/2). Spin is the basis for magnetism and quantum computing.',
        'The Pauli exclusion principle states that no two identical fermions can occupy the same quantum state simultaneously. This principle explains the electron shell structure of atoms.',
        'Quantum tunneling is the phenomenon where a particle passes through a potential energy barrier that it classically could not overcome. It is essential in nuclear fusion and semiconductor devices.',
        'Superposition is the principle that a quantum system can exist in multiple states simultaneously until measured. Measurement causes wavefunction collapse to a definite eigenstate.',
        'The Born rule states that the probability of measuring a quantum state is given by the squared modulus of the wavefunction amplitude: P = |ψ|².',
    ],
    'Operating Systems': [
        'Process scheduling determines which process runs on the CPU at any given time. Common algorithms include First-Come-First-Served (FCFS), Shortest Job Next (SJN), Round Robin, and Priority Scheduling.',
        'Virtual memory allows processes to use more memory than physically available by using disk space as an extension of RAM. Page tables map virtual addresses to physical addresses.',
        'Deadlock occurs when processes hold resources and wait for others in a circular chain. The four necessary conditions are mutual exclusion, hold and wait, no preemption, and circular wait.',
        'A mutex (mutual exclusion) is a synchronization primitive that prevents multiple threads from accessing a shared resource simultaneously. Semaphores generalize mutexes to allow a count of concurrent accesses.',
        'File systems organize data on storage devices. Common types include FAT32, NTFS, ext4, and APFS. They manage blocks, inodes, directories, and metadata for efficient data storage and retrieval.',
        'Memory management involves allocation, deallocation, and organization of memory. Techniques include paging, segmentation, and the buddy system. Fragmentation (internal and external) is a key challenge.',
        'Context switching is the process of saving and restoring the state of a process so the CPU can switch between processes. It involves saving registers, program counter, and memory mappings.',
        'The kernel is the core component of an operating system. It manages hardware resources, provides system calls, and handles interrupts. Monolithic and microkernel are two common architectures.',
        'Inter-process communication (IPC) mechanisms include pipes, message queues, shared memory, and sockets. They allow processes to exchange data and synchronize their execution.',
        'Thrashing occurs when a system spends more time swapping pages in and out of memory than executing processes. It happens when the working set of processes exceeds available physical memory.',
    ],
    'Calculus': [
        'The derivative of a function f(x) represents its instantaneous rate of change. The derivative of xⁿ is nxⁿ⁻¹. Derivatives are used to find slopes of tangent lines, velocities, and optimization.',
        'The Fundamental Theorem of Calculus connects differentiation and integration: ∫ₐᵇ f(x)dx = F(b) - F(a), where F is an antiderivative of f. This bridges differential and integral calculus.',
        'Limits form the foundation of calculus. The limit of f(x) as x approaches a is L if f(x) gets arbitrarily close to L as x approaches a. Limits define derivatives and integrals.',
        'Integration by parts is derived from the product rule: ∫u dv = uv - ∫v du. It is used to integrate products of functions, especially when one factor simplifies upon differentiation.',
        'Taylor series expand a function as an infinite sum of terms involving derivatives at a point: f(x) = Σ f⁽ⁿ⁾(a)(x-a)ⁿ/n!. They approximate complex functions with polynomials.',
        'The chain rule gives the derivative of composite functions: d/dx[f(g(x))] = f\'(g(x))·g\'(x). It is essential for differentiating nested functions and implicit differentiation.',
        'L\'Hôpital\'s rule evaluates limits of indeterminate forms (0/0 or ∞/∞) by taking derivatives: lim f(x)/g(x) = lim f\'(x)/g\'(x) if the latter limit exists.',
        'Partial derivatives extend differentiation to functions of multiple variables. ∂f/∂x is the rate of change of f with respect to x while holding other variables constant.',
        'The definite integral ∫ₐᵇ f(x)dx computes the signed area between f(x) and the x-axis from a to b. Riemann sums approximate this area using rectangles.',
        'Differential equations describe relationships between functions and their derivatives. First-order ODEs like dy/dx = ky have solutions y = Ce^(kx). They model growth, decay, and physical systems.',
    ],
    'Computer Networks': [
        'The OSI model divides network communication into seven layers: Physical, Data Link, Network, Transport, Session, Presentation, and Application. Each layer provides services to the layer above.',
        'TCP (Transmission Control Protocol) provides reliable, ordered, error-checked delivery of data. It uses a three-way handshake (SYN, SYN-ACK, ACK) to establish connections.',
        'DNS (Domain Name System) translates human-readable domain names to IP addresses. It uses a hierarchical structure with root servers, TLD servers, and authoritative name servers.',
        'HTTP (Hypertext Transfer Protocol) is the foundation of web communication. HTTP/2 supports multiplexing and header compression. HTTP/3 uses QUIC protocol built on UDP for faster connections.',
        'Routing algorithms determine the best path for data packets. Distance vector (RIP) and link-state (OSPF) are interior gateway protocols. BGP is the exterior gateway protocol for internet routing.',
        'A firewall monitors and controls incoming and outgoing network traffic based on security rules. Types include packet-filtering, stateful inspection, proxy, and next-generation firewalls.',
        'NAT (Network Address Translation) maps private IP addresses to public addresses, allowing multiple devices to share a single public IP. It helps conserve IPv4 address space.',
        'Subnetting divides a network into smaller subnetworks. Subnet masks determine the network and host portions of an IP address. CIDR notation (e.g., /24) specifies the subnet mask length.',
        'TLS (Transport Layer Security) encrypts communication between clients and servers. It uses asymmetric cryptography for key exchange and symmetric encryption for data transfer.',
        'ARP (Address Resolution Protocol) maps IP addresses to MAC addresses on a local network. An ARP request is broadcast to find the MAC address associated with a given IP.',
    ],
    'Probability & Statistics': [
        'Bayes\' theorem relates conditional probabilities: P(A|B) = P(B|A)P(A)/P(B). It is the foundation of Bayesian inference, spam filters, and medical diagnosis systems.',
        'The normal distribution (Gaussian) is characterized by its mean (μ) and standard deviation (σ). About 68% of data falls within 1σ, 95% within 2σ, and 99.7% within 3σ of the mean.',
        'Hypothesis testing evaluates claims about populations using sample data. The p-value is the probability of observing results as extreme as the test statistic under the null hypothesis.',
        'The Central Limit Theorem states that the distribution of sample means approaches a normal distribution as sample size increases, regardless of the population distribution.',
        'Regression analysis models the relationship between a dependent variable and one or more independent variables. Linear regression fits a line y = mx + b that minimizes squared errors.',
        'Standard deviation measures the spread of data around the mean. It is the square root of variance. A low standard deviation indicates data points cluster near the mean.',
        'Correlation measures the linear relationship between two variables. Pearson\'s r ranges from -1 to +1. Correlation does not imply causation.',
        'A confidence interval estimates a population parameter with a given level of confidence. A 95% confidence interval means we expect 95% of such intervals to contain the true parameter.',
        'The binomial distribution models the number of successes in n independent trials with probability p. Its mean is np and variance is np(1-p).',
        'Maximum likelihood estimation (MLE) finds parameter values that maximize the probability of observing the data. It is a fundamental method for parameter estimation in statistical models.',
    ],
};

// ── Synthetic embedding generator ─────────────────────────────────────────────

/**
 * Generate a deterministic pseudo-embedding based on text content.
 * This creates embeddings where similar content will have similar vectors.
 */
function generateSyntheticEmbedding(text, dim = 384) {
    const vector = new Array(dim).fill(0);

    // Create deterministic features from text
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const wordSet = new Set(words);

    // Subject-specific seed dimensions
    const subjectSeeds = {
        'energy': [0, 20, 40], 'heat': [1, 21, 41], 'entropy': [2, 22, 42],
        'temperature': [3, 23, 43], 'pressure': [4, 24, 44], 'thermodynamic': [5, 25, 45],
        'binary': [50, 70, 90], 'tree': [51, 71, 91], 'hash': [52, 72, 92],
        'stack': [53, 73, 93], 'queue': [54, 74, 94], 'graph': [55, 75, 95],
        'sort': [56, 76, 96], 'linked': [57, 77, 97], 'node': [58, 78, 98],
        'matrix': [100, 120, 140], 'vector': [101, 121, 141], 'eigenvalue': [102, 122, 142],
        'linear': [103, 123, 143], 'determinant': [104, 124, 144],
        'carbon': [150, 170, 190], 'molecule': [151, 171, 191], 'reaction': [152, 172, 192],
        'bond': [153, 173, 193], 'organic': [154, 174, 194],
        'neural': [200, 220, 240], 'learning': [201, 221, 241], 'gradient': [202, 222, 242],
        'model': [203, 223, 243], 'training': [204, 224, 244],
        'quantum': [250, 270, 290], 'wave': [251, 271, 291], 'electron': [252, 272, 292],
        'spin': [253, 273, 293], 'particle': [254, 274, 294],
        'process': [300, 320, 340], 'memory': [301, 321, 341], 'kernel': [302, 322, 342],
        'thread': [303, 323, 343], 'scheduling': [304, 324, 344],
        'derivative': [30, 60, 130], 'integral': [31, 61, 131], 'limit': [32, 62, 132],
        'function': [33, 63, 133], 'calculus': [34, 64, 134],
        'network': [350, 360, 370], 'protocol': [351, 361, 371], 'tcp': [352, 362, 372],
        'ip': [353, 363, 373], 'routing': [354, 364, 374],
        'probability': [160, 180, 260], 'distribution': [161, 181, 261],
        'mean': [162, 182, 262], 'variance': [163, 183, 263], 'hypothesis': [164, 184, 264],
        'algorithm': [56, 205, 305], 'data': [57, 206, 306], 'search': [58, 207, 307],
        'law': [5, 35, 165], 'system': [6, 36, 166], 'equation': [7, 37, 167],
        'second': [8, 38, 168], 'first': [9, 39, 169],
    };

    // Set dimensions based on keywords found in text
    for (const [keyword, dims] of Object.entries(subjectSeeds)) {
        if (wordSet.has(keyword)) {
            for (const d of dims) {
                if (d < dim) vector[d] += 0.5;
            }
        }
    }

    // Add some hash-based noise for uniqueness
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        let hash = 0;
        for (let j = 0; j < word.length; j++) {
            hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
        }
        const idx = Math.abs(hash) % dim;
        vector[idx] += 0.1;
    }

    // Normalize to unit length
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
        for (let i = 0; i < dim; i++) {
            vector[i] /= norm;
        }
    }

    return vector;
}

// ── Download helper ───────────────────────────────────────────────────────────

function downloadFile(url, destPath, redirectCount = 0) {
    if (redirectCount > 5) {
        return Promise.reject(new Error('Too many redirects'));
    }

    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (response) => {
            const { statusCode } = response;

            // Handle redirects (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(statusCode)) {
                let redirectUrl = response.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    const parsedUrl = new URL(url);
                    redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`;
                }

                console.log(`  ↳ Redirecting (${statusCode}) to ${redirectUrl.substring(0, 80)}...`);

                // Consume response data to free up memory
                response.resume();

                downloadFile(redirectUrl, destPath, redirectCount + 1)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (statusCode !== 200) {
                response.resume();
                reject(new Error(`HTTP ${statusCode}`));
                return;
            }

            const file = fs.createWriteStream(destPath);
            const totalBytes = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;

            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes) {
                    const pct = Math.round((downloadedBytes / totalBytes) * 100);
                    process.stdout.write(`\r  ↳ ${pct}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
                }
            });

            response.pipe(file);
            file.on('finish', () => {
                if (totalBytes) console.log('');
                file.close(resolve);
            });

            file.on('error', (err) => {
                fs.unlink(destPath, () => reject(err));
            });

        }).on('error', (err) => {
            reject(err);
        });
    });
}


// ── Main Setup Flow ───────────────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   Cortex Demo Setup                      ║');
    console.log('║   Offline AI Platform for Students       ║');
    console.log('╚══════════════════════════════════════════╝\n');

    // 1. Download model
    console.log('📦 Step 1/3: Downloading BGE-small-en-v1.5 model...\n');

    if (!fs.existsSync(MODEL_DIR)) {
        fs.mkdirSync(MODEL_DIR, { recursive: true });
    }

    for (const file of MODEL_FILES) {
        const destPath = path.join(MODEL_DIR, file.dest);
        if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
            console.log(`  ✓ ${file.dest} already exists and is non-empty, skipping.`);
            continue;
        }

        console.log(`  ↓ Downloading ${file.dest}...`);
        try {
            await downloadFile(file.url, destPath);
            console.log(`  ✓ ${file.dest} downloaded.`);
        } catch (error) {
            console.error(`  ✗ Failed to download ${file.dest}: ${error.message}`);
            console.log('  ⚠ Demo will use synthetic embeddings instead.');
        }
    }

    // 2. Generate demo database
    console.log('\n📚 Step 2/3: Generating 100 academic documents...\n');

    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Remove old database if it exists
    if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
    }

    const db = initializeDatabase(DB_PATH);

    // Wrap db for our use
    const insertDoc = db.prepare(
        'INSERT INTO documents (title, subject, content, chunk_index) VALUES (?, ?, ?, ?)'
    );
    const insertEmb = db.prepare(
        'INSERT INTO embeddings (doc_id, vector) VALUES (?, ?)'
    );

    const transaction = db.transaction(() => {
        let docCount = 0;
        for (const [subject, contents] of Object.entries(SUBJECTS)) {
            for (let i = 0; i < contents.length; i++) {
                const title = `${subject} - Concept ${i + 1}`;
                const content = contents[i];

                const result = insertDoc.run(title, subject, encryptText(content), i);
                const vector = generateSyntheticEmbedding(content);
                const buffer = encryptEmbedding(vector);
                insertEmb.run(result.lastInsertRowid, buffer);

                docCount++;
                process.stdout.write(`\r  ✓ Generated ${docCount}/100 documents`);
            }
        }
        console.log('');
    });

    transaction();

    // 3. Verify
    console.log('\n🔍 Step 3/3: Verifying setup...\n');

    const docCount = db.prepare('SELECT COUNT(*) as count FROM documents').get();
    const embCount = db.prepare('SELECT COUNT(*) as count FROM embeddings').get();
    const subjects = db.prepare('SELECT DISTINCT subject FROM documents').all();

    console.log(`  ✓ Documents: ${docCount.count}`);
    console.log(`  ✓ Embeddings: ${embCount.count}`);
    console.log(`  ✓ Subjects: ${subjects.map(s => s.subject).join(', ')}`);

    // Quick test search
    console.log('\n🧪 Quick search test: "thermodynamics entropy"');
    const testQuery = 'thermodynamics entropy';
    const testVector = generateSyntheticEmbedding(testQuery);
    const { decryptEmbedding: decEmb } = require('../src/services/encryption');

    const allEmbeddings = db.prepare(`
    SELECT e.doc_id, e.vector, d.title, d.content
    FROM embeddings e JOIN documents d ON e.doc_id = d.id
  `).all();

    const scores = allEmbeddings.map(row => {
        const storedVector = decEmb(row.vector);
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < testVector.length; i++) {
            dot += testVector[i] * storedVector[i];
            normA += testVector[i] * testVector[i];
            normB += storedVector[i] * storedVector[i];
        }
        const score = dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-12);
        return { title: row.title, score };
    });

    scores.sort((a, b) => b.score - a.score);
    console.log(`  Top 3 results:`);
    for (let i = 0; i < 3; i++) {
        console.log(`    ${i + 1}. ${scores[i].title} (score: ${scores[i].score.toFixed(3)})`);
    }

    db.close();

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   ✅ Cortex Setup Complete!               ║');
    console.log('║   Run: npm start                         ║');
    console.log('╚══════════════════════════════════════════╝');
}

main().catch((err) => {
    console.error('Setup failed:', err);
    process.exit(1);
});
