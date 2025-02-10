// שירותים שונים הקשורים להעלאת תמונות או ניהול קבצים, במקרה הזה התמונות שמועלות ל-Firebase
const uploadAvatar = async (file) => {
    try {
        const fileUpload = bucket.file(`profile_pictures/${file.originalname}`);
        const stream = fileUpload.createWriteStream({
            metadata: {
                contentType: file.mimetype
            }
        });

        stream.on('error', (err) => {
            console.error('Error uploading avatar:', err);
            throw new Error('Upload failed');
        });

        stream.on('finish', () => {
            console.log('Avatar uploaded successfully');
        });

        stream.end(file.buffer);
    } catch (error) {
        console.error('Error uploading avatar:', error);
        throw error;
    }
};

module.exports = { uploadAvatar };
