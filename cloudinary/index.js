const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');


cloudinary.config({ 
    cloud_name: 'clearview01', 
    api_key: '165456636191561', 
    api_secret: 'G1XoGHjLf40bPsksxW6AfLu1Nuc' 
  });


const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'Blog',
        allowedFormats: ['JPEG','PNG','JPG']
    }
})

module.exports = {
    cloudinary,
    storage
}