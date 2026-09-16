// assets/config.js
// Hàm giải mã Base64 tự động khi ứng dụng chạy
const decodeKey = (base64Str) => atob(base64Str);

const CONFIG = {
    // Danh sách 11 API Key Gemini (Đã mã hóa Base64)
    GEMINI_API_KEYS: [
        decodeKey("QVEuQWI4Uk42SVRwYUdxN0lyZVdpS2pEWFJNc19XYzZjRTlkb19KenBTREcyLTQ1V0M3OVE="),
        decodeKey("QVEuQWI4Uk42S0VhYktQODV1NzgwOGZIUTVqUVp1X2lJRjAxUmpBb0ZxeGFXQVFGSTg2WkE="),
        decodeKey("QVEuQWI4Uk42SmJYOG5Rb2hEajl2eGQzdk1PV1RBUTk4T0RfM05sNmNOSkE5ZzVjLURtWmc="),
        decodeKey("QVEuQWI4Uk42TEgyMGZERkRDVU1YMGNFZWVROEdRZnhEYjhORlNXRnpyVlM4WWs5WFVR"),
        decodeKey("QVEuQWI4Uk42SzhfUjZoX3oxTEk2YV9oMndVLXlJQUpMd0IxZFdPcElxN0tkQkl1WE9iSGc="),
        decodeKey("QVEuQWI4Uk42S3RuNEpneFNMT2tpb1BRS2Y2bmI0QnJMTXM0emE0RkpqNl9TYml5WE5BSEE="),
        decodeKey("QVEuQWI4Uk42S2NSX1FSR09MQjVFRXVDeVBCdXZCMDlaME43Y0JBMmN0RUNrdUxjSjI1ZVE="),
        decodeKey("QVEuQWI4Uk42SXZlZWpLZzB4YjQ4YnhobXJCQXBMYlBzMGRBQVRXaTdtVU5Iei9YVW9PUSA="),
        decodeKey("QVEuQWI4Uk42S2Zsa1EwM3pvMTBuYURMdnFINW1TU3RnQmtVTjUzbE14ZWR4LVRBM2lB"),
        decodeKey("QVEuQWI4Uk42SkRGTTY1dG00RURjQ0hwYzhVMjB2RjdZZkxYckJxM3o0akZ5R1d2cUcyQQ=="),
        decodeKey("QVEuQWI4Uk42SzdZNEhrNVJ6Y011RHRIWTBQc2hWQlptQ0dFczE0YUR4SUpOd19ZY2pYdw==")
    ],

    // Groq API Key chuẩn Base64 của bạn
    GROQ_API_KEY: decodeKey("Z3NrX1Z1UUR3M1ZjTHhTRlZWVWxQMVJUV0dkeWIzRllGc2RmQ2ZJS2hWZXNNYmRvSEFhMGh0bXc"),

    // Cấu hình mặc định
    DEFAULT_MODEL: "gpt_oss_120b",
    DEFAULT_EFFORT: "medium",
    IS_THINKING_ENABLED: true
};

export default CONFIG;
