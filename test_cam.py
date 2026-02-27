import cv2

def test_cam():
    print("Testing cv2.VideoCapture(0)")
    cap = cv2.VideoCapture(0)
    print("Is opened:", cap.isOpened())
    if cap.isOpened():
        ret, frame = cap.read()
        print("Read success:", ret)
        if ret:
            print("Frame shape:", frame.shape)
    cap.release()

    print("Testing cv2.VideoCapture(1)")
    cap1 = cv2.VideoCapture(1)
    print("Is opened 1:", cap1.isOpened())
    cap1.release()

    print("Testing cv2.VideoCapture(0, cv2.CAP_DSHOW)")
    cap2 = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    print("Is opened DSHOW:", cap2.isOpened())
    cap2.release()

if __name__ == "__main__":
    test_cam()
