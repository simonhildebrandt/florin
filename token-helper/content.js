let key = window.localStorage.key(0)
let json = window.localStorage.getItem(key)
let token = JSON.parse(json).body.access_token
const response = await fetch(
  "http://127.0.0.1:5001/florin-6aad0/us-central1/api/update", {
    method: "POST",
    body: JSON.stringify({token}),
    headers: {
      "Content-Type": "application/json"
    }
  }
)
console.log(response)
