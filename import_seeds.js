const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join('/home/szymou/workspace/java-eight-part-system', 'data', 'questions.db');
console.log('Using database:', dbPath);

const seedFiles = [
  { file: '/home/szymou/workspace/java-eight-part-system/seed_go.js', domain: 'go' },
  { file: '/home/szymou/workspace/java-eight-part-system/seed_go_extra.js', domain: 'go' },
  { file: '/home/szymou/workspace/java-eight-part-system/seed_python_final.js', domain: 'python' },
  { file: '/home/szymou/workspace/java-eight-part-system/seed_python_extra.js', domain: 'python' },
  { file: '/home/szymou/workspace/java-eight-part-system/seed_frontend.js', domain: 'frontend' },
  { file: '/home/szymou/workspace/java-eight-part-system/seed_frontend_extra.js', domain: 'frontend' },
  { file: '/home/szymou/workspace/java-eight-part-system/seed_database.js', domain: 'database' },
  { file: '/home/szymou/workspace/java-eight-part-system/seed_database_extra.js', domain: 'database' },
  { file: '/home/szymou/workspace/java-eight-part-system/seed_devops.js', domain: 'devops' },
  { file: '/home/szymou/workspace/java-eight-part-system/seed_devops_extra.js', domain: 'devops' }
];

async function main() {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) console.error('Error opening DB:', err);
    else console.log('Database opened');
  });

  db.serialize(async () => {
    try {
      // First, check existing counts
      const existingCounts = await new Promise((resolve, reject) => {
        db.all("SELECT tech_domain, COUNT(*) as cnt FROM questions GROUP BY tech_domain", (err, rows) => {
          if (err) reject(err);
          else {
            const counts = {};
            rows.forEach(row => counts[row.tech_domain] = row.cnt);
            resolve(counts);
          }
        });
      });

      console.log('Current database counts:', existingCounts);

      for (const { file, domain } of seedFiles) {
        try {
          console.log(`\nLoading ${domain} seeds from ${file}`);
          const seeds = require(file);
          if (!Array.isArray(seeds)) {
            console.log(`${domain} seeds not an array, skipping`);
            continue;
          }

          console.log(`Found ${seeds.length} ${domain} seed questions`);

          let inserted = 0;
          for (const q of seeds) {
            // Format: [category, subcategory, question, answer, difficulty, tags, domain]
            const category = q[0] || `${domain}综合`;
            const subcategory = q[1] || '种子题';
            const questionText = q[2];
            const answer = q[3];
            const difficulty = q[4] || 'medium';
            const tags = q[5] || `seed,${domain}`;
            const dom = q[6] || domain;

            if (!questionText || !answer) continue;

            const result = await new Promise((resolve, reject) => {
              db.run(
                "INSERT OR IGNORE INTO questions (category, subcategory, question, answer, difficulty, tags, tech_domain) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [category, subcategory, questionText, answer, difficulty, tags, dom],
                function(err) {
                  if (err) reject(err);
                  else resolve(this.changes > 0);
                }
              );
            });
            if (result) inserted++;
          }

          console.log(`Inserted ${inserted} new ${domain} questions`);
        } catch (e) {
          console.error(`Error processing ${domain}:`, e.message);
        }
      }

      // Final counts
      const finalCounts = await new Promise((resolve, reject) => {
        db.all("SELECT tech_domain, COUNT(*) as cnt FROM questions GROUP BY tech_domain ORDER BY tech_domain", (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      console.log('\n✓ Done! Final counts:');
      let total = 0;
      finalCounts.forEach(row => {
        console.log(`  ${row.tech_domain}: ${row.cnt} questions`);
        total += row.cnt;
      });
      console.log(`  TOTAL: ${total} questions`);

    } catch (err) {
      console.error('Error:', err);
    } finally {
      db.close();
    }
  });
}

main().catch(console.error);
