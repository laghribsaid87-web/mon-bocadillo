const url = "https://us-central1-mon-bocadillo-menu.cloudfunctions.net/glovoMenuDownload?appId=mon-bocadillo-menu&token=85a63535-ae38-4c31-88dc-e41fbc29da0a";

fetch(url)
    .then(res => res.json())
    .then(data => {
        data.products.forEach(p => {
            if (p.name.toLowerCase().includes('cheese') || p.name.toLowerCase().includes('bocadillo')) {
                console.log(p.name, JSON.stringify(p.groups || []));
            }
        });
    })
    .catch(console.error);
