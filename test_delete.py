import sys
sys.path.append('.')
from backend.mongo_client import notifications_collection

# Delete any notification where the message starts with "Reyca"
res = notifications_collection.delete_many({'message': {'$regex': '^Reyca'}})
print(f'Deleted {res.deleted_count} Reyca notifications.')

# Delete any notification where the message starts with "John Doe deleted"
res2 = notifications_collection.delete_many({'message': {'$regex': '^John Doe deleted'}})
print(f'Deleted {res2.deleted_count} John Doe notifications.')
