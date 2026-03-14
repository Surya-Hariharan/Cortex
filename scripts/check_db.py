import sqlite3
conn = sqlite3.connect('data/database/cortex.db')
conn.execute('PRAGMA foreign_keys = ON')
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [row[0] for row in c.fetchall()]
print("Tables:", tables)

c.execute("PRAGMA table_info(users)")
print("\nUsers schema:", c.fetchall())

c.execute("PRAGMA table_info(chats)")
print("\nChats schema:", c.fetchall())

c.execute("PRAGMA foreign_key_list(chats)")
print("\nChats FKs:", c.fetchall())

c.execute("SELECT id, email FROM users ORDER BY rowid DESC LIMIT 5")
print("\nRecent users:", c.fetchall())

# Try inserting a chat manually
try:
    c.execute("SELECT id FROM users ORDER BY rowid DESC LIMIT 1")
    uid = c.fetchone()
    print("\nLast user id:", uid)
    if uid:
        import uuid as _uuid
        chat_id = str(_uuid.uuid4())
        c.execute("INSERT INTO chats (id, user_id, title, model, version) VALUES (?, ?, ?, ?, ?)",
                  (chat_id, uid[0], "Test", "phi-3-mini", 1))
        conn.commit()
        print("Manual chat insert: OK, id=", chat_id)
        # cleanup
        c.execute("DELETE FROM chats WHERE id=?", (chat_id,))
        conn.commit()
except Exception as e:
    print("Manual chat insert error:", e)

conn.close()
