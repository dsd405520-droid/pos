#!/bin/sh
# ເລີ່ມ container ແບບປອດໄພ:
#   1. ລໍຖ້າ MongoDB ພ້ອມ (internal network mongodb:27017)
#   2. ຮັນ seed.js ໂດຍອັດຕະໂນມັດ (idempotent — admin ມີແລ້ວຈະຂ້າມ)
#   3. ຮັນຄໍາສັ່ງຕົ້ນສະບັບ (CMD: npm start)
set -e

: "${MONGO_URI:=mongodb://mongodb:27017/retail_pos}"

echo "⏳ ກໍາລັງລໍຖ້າ MongoDB ($MONGO_URI) ..."
i=0
while [ "$i" -lt 120 ]; do
  if node -e "const m=require('mongoose');const u=process.env.MONGO_URI||'mongodb://mongodb:27017/retail_pos';m.connect(u,{serverSelectionTimeoutMS:2000}).then(()=>process.exit(0)).catch(()=>process.exit(1));" >/dev/null 2>&1; then
    echo "✅ MongoDB ພ້ອມແລ້ວ"
    break
  fi
  i=$((i + 1))
  sleep 1
done

echo "📦 ຮັນ seed admin (ຂ້າມຖ້າມີຢູ່ແລ້ວ)..."
node seed.js >/dev/null 2>&1 || echo "⚠️ seed ບໍ່ສຳເລັດ (ບໍ່ແມ່ນເລື່ອງຮຸນແຮງ)"

echo "🚀 ເລີ່ມແອັບ..."
exec "$@"