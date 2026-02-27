import gotrue
print(dir(gotrue))
try:
    from gotrue import Client
    print("Client imported from gotrue")
except ImportError:
    print("Client NOT in gotrue")

try:
    from gotrue.client import Client
    print("Client imported from gotrue.client")
except ImportError:
    print("Client NOT in gotrue.client")
