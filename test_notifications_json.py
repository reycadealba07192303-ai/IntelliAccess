import sys
import json
sys.path.append('.')
from backend.mongo_client import notifications_collection

notifs = []
for n in notifications_collection.find().sort('_id', -1).limit(6):
    n['_id'] = str(n['_id'])
    notifs.append(n)

with open('notifs_dump.json', 'w') as f:
    json.dump(notifs, f, indent=2)
print("Dumped to notifs_dump.json")
