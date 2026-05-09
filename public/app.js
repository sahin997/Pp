async function generateCode() {

  const number =
  document.getElementById("number").value

  if(!number) {
    alert("Enter WhatsApp Number")
    return
  }

  document.getElementById("code").innerText =
  "Generating..."

  try {

    const res = await fetch("/pair", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        number
      })
    })

    const data = await res.json()

    if(!data.status) {

      alert(data.error || data.msg)
    }

  } catch(e) {

    alert("Server Error")
    console.log(e)
  }
}

async function loadCode() {

  try {

    const res = await fetch("/code")

    const data = await res.json()

    document.getElementById("code").innerText =
    data.code

    const status =
    document.getElementById("status")

    if(data.connected) {

      status.innerText = "Connected"
      status.className = "status online"

    } else {

      status.innerText = "Waiting For Login"
      status.className = "status offline"
    }

  } catch(e) {

    console.log(e)
  }
}

setInterval(loadCode, 3000)

loadCode()

function copyCode() {

  const code =
  document.getElementById("code").innerText

  navigator.clipboard.writeText(code)

  alert("Code Copied")
}
