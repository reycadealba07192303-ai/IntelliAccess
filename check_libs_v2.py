import gotrue
import postgrest

print("--- GoTrue Attributes ---")
for attr in dir(gotrue):
    print(attr)

print("\n--- PostgREST Attributes ---")
for attr in dir(postgrest):
    print(attr)
