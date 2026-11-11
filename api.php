<?php
/**
 * ========================================================
 * 🚀 Photo Earn - Central PHP Backend Engine (api.php)
 * কোনো MySQL বা Firebase লাগবে না — স্বয়ংসম্পূর্ণ ও আল্ট্রা-ফাস্ট
 * ========================================================
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dataDir = __DIR__ . '/data';
$uploadDir = __DIR__ . '/uploads';

if (!is_dir($dataDir)) @mkdir($dataDir, 0755, true);
if (!is_dir($uploadDir)) @mkdir($uploadDir, 0755, true);

$photosFile = $dataDir . '/photos.json';
$usersFile = $dataDir . '/users.json';
$withdrawsFile = $dataDir . '/withdraws.json';
$statsFile = $dataDir . '/stats.json';
$themeVotesFile = $dataDir . '/theme_votes.json';

// ===== 🔔 টেলিগ্রাম ইনস্ট্যান্ট নোটিফিকেশন কনফিগ (ঐচ্ছিক) =====
// আপনি চাইলে BotFather থেকে একটি ফ্রি বট খুলে এখানে টোকেন ও চ্যাট আইডি দিতে পারেন
$tgBotToken = ""; // উদাহরণ: "7123456789:AAH..."
$tgChatId = "";   // উদাহরণ: "123456789"

function sendTelegramNotification($message) {
    global $tgBotToken, $tgChatId;
    if (empty($tgBotToken) || empty($tgChatId)) return;
    $url = "https://api.telegram.org/bot{$tgBotToken}/sendMessage";
    $data = [
        'chat_id' => $tgChatId,
        'text' => $message,
        'parse_mode' => 'HTML'
    ];
    $ch = curl_init($url);
    if ($ch) {
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_exec($ch);
        curl_close($ch);
    }
}

// হেল্পার ফাংশন: ফাইল রিড
function readJson($file, $default = []) {
    if (!file_exists($file)) return $default;
    $content = file_get_contents($file);
    $data = json_decode($content, true);
    return is_array($data) ? $data : $default;
}

// হেল্পার ফাংশন: ফাইল রাইট
function writeJson($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

// ডিফল্ট ডাটা ইনিশিয়ালাইজেশন
if (!file_exists($photosFile)) {
    $defaultPhotos = [
        [
            "id" => "photo_1",
            "title" => "গ্রামের শান্ত বিকেল ও সূর্যাস্ত",
            "category" => "গ্রামের দৃশ্য",
            "authorName" => "তানভীর হাসান",
            "authorPin" => "1234",
            "url" => "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80",
            "views" => 342,
            "votes" => 68,
            "contestType" => "c24",
            "approved" => true,
            "date" => date('c', strtotime('-4 hours'))
        ],
        [
            "id" => "photo_2",
            "title" => "নদীর বুকে পালতোলা নৌকা",
            "category" => "নদী ও নৌকা",
            "authorName" => "রাকিবুল ইসলাম",
            "authorPin" => "2345",
            "url" => "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800&auto=format&fit=crop&q=80",
            "views" => 654,
            "votes" => 112,
            "contestType" => "c7",
            "approved" => true,
            "date" => date('c', strtotime('-20 hours'))
        ],
        [
            "id" => "photo_3",
            "title" => "কুয়াশা ঘেরা শীতের সকালের মাঠ",
            "category" => "শীতের সকাল",
            "authorName" => "আরিফ চৌধুরী",
            "authorPin" => "3456",
            "url" => "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=800&auto=format&fit=crop&q=80",
            "views" => 890,
            "votes" => 145,
            "contestType" => "c30",
            "approved" => true,
            "date" => date('c', strtotime('-48 hours'))
        ],
        [
            "id" => "photo_4",
            "title" => "গাছের ডালে রঙিন মাছরাঙা পাখি",
            "category" => "পাখির ছবি",
            "authorName" => "মেহেদী হাসান",
            "authorPin" => "4567",
            "url" => "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&auto=format&fit=crop&q=80",
            "views" => 240,
            "votes" => 45,
            "contestType" => "c24",
            "approved" => true,
            "date" => date('c', strtotime('-2 hours'))
        ]
    ];
    writeJson($photosFile, $defaultPhotos);
}

// ইনপুট গ্রহণ
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: [];
$action = $_GET['action'] ?? ($input['action'] ?? '');

switch ($action) {

    // ১. সাইটের ভিজিটর পরিসংখ্যান
    case 'stats':
        $stats = readJson($statsFile, ["total" => 12450, "today" => 120, "lastDate" => date('Y-m-d')]);
        $today = date('Y-m-d');
        if (($stats['lastDate'] ?? '') !== $today) {
            $stats['lastDate'] = $today;
            $stats['today'] = 0;
        }
        $stats['total'] = ($stats['total'] ?? 12450) + 1;
        $stats['today'] = ($stats['today'] ?? 0) + 1;
        writeJson($statsFile, $stats);
        echo json_encode(["success" => true, "stats" => $stats]);
        break;

    // ২. সব ছবি লোড করা
    case 'get_photos':
        $photos = readJson($photosFile, []);
        echo json_encode(["success" => true, "photos" => $photos]);
        break;

    // ৩. নতুন ছবি আপলোড (ইমেজ সরাসরি uploads/ ফোল্ডারে সেভ হবে)
    case 'upload_photo':
        $title = trim($input['title'] ?? '');
        $category = trim($input['category'] ?? 'প্রকৃতি');
        $contestType = trim($input['contestType'] ?? 'c24');
        $authorName = trim($input['authorName'] ?? 'শিল্পী');
        $authorPin = trim($input['authorPin'] ?? '');
        $imgData = $input['image'] ?? '';

        if (empty($title) || empty($imgData)) {
            echo json_encode(["success" => false, "message" => "ছবির শিরোনাম বা ডাটা পাওয়া যায়নি!"]);
            exit;
        }

        $photoId = !empty($input['id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $input['id']) : ('photo_' . time() . '_' . rand(100, 999));
        $fileName = $photoId . '.jpg';
        $filePath = $uploadDir . '/' . $fileName;

        // Base64 ইমেজ ডিকোড করে ফাইল আকারে সংরক্ষণ
        if (preg_match('/^data:image\/(\w+);base64,/', $imgData, $type)) {
            $imgData = substr($imgData, strpos($imgData, ',') + 1);
            $imgData = base64_decode($imgData);
            file_put_contents($filePath, $imgData);
            $fileUrl = 'uploads/' . $fileName;
        } else {
            $fileUrl = $imgData; // অলরেডি URL থাকলে
        }

        $photoType = trim($input['photoType'] ?? 'FREE');
        $price = intval($input['price'] ?? 0);
        $newPhoto = [
            "id" => $photoId,
            "title" => $title,
            "category" => $category,
            "contestType" => $contestType,
            "authorName" => $authorName,
            "authorPin" => $authorPin,
            "photoType" => $photoType,
            "price" => $price,
            "url" => $fileUrl,
            "views" => 0,
            "votes" => 0,
            "approved" => false,
            "status" => "pending",
            "date" => date('c')
        ];

        $photos = readJson($photosFile, []);
        array_unshift($photos, $newPhoto);
        writeJson($photosFile, $photos);

        // ইউজারের আপলোড কাউন্ট বাড়ানো
        if (!empty($authorPin)) {
            $users = readJson($usersFile, []);
            if (isset($users[$authorPin])) {
                $users[$authorPin]['photosCount'] = ($users[$authorPin]['photosCount'] ?? 0) + 1;
                writeJson($usersFile, $users);
            }
        }

        // টেলিগ্রাম অ্যালার্ট নোটিফিকেশন
        sendTelegramNotification("📷 <b>নতুন ছবি জমা পড়েছে!</b>\nশিরোনাম: {$title}\nশিল্পী: {$authorName}\nক্যাটাগরি: {$category}");

        echo json_encode(["success" => true, "photo" => $newPhoto]);
        break;

    // ৪. ছবিতে ভোট দেওয়া
    case 'vote':
        $photoId = $input['photoId'] ?? '';
        $userIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $photos = readJson($photosFile, []);
        $found = false;
        $newVotes = 0;

        foreach ($photos as &$p) {
            if ($p['id'] === $photoId) {
                $p['votes'] = ($p['votes'] ?? 0) + 1;
                $newVotes = $p['votes'];
                $found = true;

                // আর্টিস্টের আর্নিং পয়েন্ট বৃদ্ধি
                if (!empty($p['authorPin'])) {
                    $users = readJson($usersFile, []);
                    if (isset($users[$p['authorPin']])) {
                        $users[$p['authorPin']]['points'] = ($users[$p['authorPin']]['points'] ?? 0) + 2;
                        $users[$p['authorPin']]['taka'] = number_format(($users[$p['authorPin']]['points'] * 0.1), 2, '.', '');
                        writeJson($usersFile, $users);
                    }
                }
                break;
            }
        }

        if ($found) {
            writeJson($photosFile, $photos);
            echo json_encode(["success" => true, "votes" => $newVotes]);
        } else {
            echo json_encode(["success" => false, "message" => "ছবি পাওয়া যায়নি!"]);
        }
        break;

    // ৫. ভিউ কাউন্ট বৃদ্ধি
    case 'view':
        $photoId = $input['photoId'] ?? '';
        $photos = readJson($photosFile, []);
        foreach ($photos as &$p) {
            if ($p['id'] === $photoId) {
                $p['views'] = ($p['views'] ?? 0) + 1;
                break;
            }
        }
        writeJson($photosFile, $photos);
        echo json_encode(["success" => true]);
        break;

    // ৬. ইউজার লগইন
    case 'login':
        $pin = trim($input['pin'] ?? '');
        $users = readJson($usersFile, []);
        if (isset($users[$pin])) {
            echo json_encode(["success" => true, "user" => $users[$pin]]);
        } else {
            echo json_encode(["success" => false, "message" => "ভুল পিন! একাউন্ট না থাকলে রেজিস্টার করুন।"]);
        }
        break;

    // ৭. ইউজার রেজিস্ট্রেশন
    case 'register':
        $pin = trim($input['pin'] ?? '');
        $name = trim($input['name'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $ref = trim($input['ref'] ?? '');

        if (strlen($pin) < 4 || empty($name) || empty($phone)) {
            echo json_encode(["success" => false, "message" => "সঠিক তথ্য দিন! পিন কমপক্ষে ৪ সংখ্যার হতে হবে।"]);
            exit;
        }

        $users = readJson($usersFile, []);
        if (isset($users[$pin])) {
            echo json_encode(["success" => false, "message" => "এই পিন দিয়ে ইতিমধ্যে একাউন্ট আছে! অন্য পিন দিন।"]);
            exit;
        }

        $newUser = [
            "pin" => $pin,
            "name" => $name,
            "phone" => $phone,
            "points" => 20, // বোনাস
            "taka" => "2.00",
            "photosCount" => 0,
            "verified" => false,
            "telegramBonus" => false,
            "refCode" => "REF" . $pin,
            "created" => date('c')
        ];

        // রেফারেল হ্যান্ডলিং
        if (!empty($ref)) {
            foreach ($users as &$u) {
                if (($u['refCode'] ?? '') === $ref) {
                    $u['points'] = ($u['points'] ?? 0) + 10;
                    $u['taka'] = number_format(($u['points'] * 0.1), 2, '.', '');
                    break;
                }
            }
        }

        $users[$pin] = $newUser;
        writeJson($usersFile, $users);
        echo json_encode(["success" => true, "user" => $newUser]);
        break;

    // ৮. টেলিগ্রাম বোনাস
    case 'claim_telegram':
        $pin = trim($input['pin'] ?? '');
        $users = readJson($usersFile, []);
        if (isset($users[$pin])) {
            if (!empty($users[$pin]['telegramBonus'])) {
                echo json_encode(["success" => false, "message" => "আপনি ইতিমধ্যে বোনাস নিয়েছেন!"]);
                exit;
            }
            $users[$pin]['telegramBonus'] = true;
            $users[$pin]['taka'] = number_format((floatval($users[$pin]['taka'] ?? 0) + 10.0), 2, '.', '');
            $users[$pin]['points'] = round(floatval($users[$pin]['taka']) / 0.1);
            writeJson($usersFile, $users);
            echo json_encode(["success" => true, "message" => "অভিনন্দন! ৳১০ বোনাস ব্যালেন্সে যুক্ত হয়েছে!", "user" => $users[$pin]]);
        } else {
            echo json_encode(["success" => false, "message" => "ইউজার পাওয়া যায়নি!"]);
        }
        break;

    // ৯. উইথড্র রিকোয়েস্ট
    case 'withdraw':
        $pin = trim($input['pin'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $amount = floatval($input['amount'] ?? 0);
        $method = trim($input['method'] ?? 'bkash');

        $users = readJson($usersFile, []);
        if (!isset($users[$pin])) {
            echo json_encode(["success" => false, "message" => "ইউজার পাওয়া যায়নি!"]);
            exit;
        }

        $user = &$users[$pin];
        if (floatval($user['taka']) < $amount) {
            echo json_encode(["success" => false, "message" => "পর্যাপ্ত ব্যালেন্স নেই!"]);
            exit;
        }
        if (($user['photosCount'] ?? 0) < 3) {
            echo json_encode(["success" => false, "message" => "টাকা তুলতে কমপক্ষে ৩টি ছবি আপলোড থাকতে হবে!"]);
            exit;
        }

        // ব্যালেন্স কাটা
        $user['taka'] = number_format((floatval($user['taka']) - $amount), 2, '.', '');
        $user['points'] = round(floatval($user['taka']) / 0.1);
        writeJson($usersFile, $users);

        $withdraws = readJson($withdrawsFile, []);
        $newWd = [
            "id" => "wd_" . time() . '_' . rand(10, 99),
            "pin" => $pin,
            "name" => $user['name'],
            "phone" => $phone,
            "amount" => $amount,
            "method" => $method,
            "status" => "pending",
            "date" => date('c')
        ];
        array_unshift($withdraws, $newWd);
        writeJson($withdrawsFile, $withdraws);

        // টেলিগ্রাম অ্যালার্ট নোটিফিকেশন
        sendTelegramNotification("💳 <b>নতুন উইথড্র আবেদন!</b>\nনাম: {$user['name']}\nমোবাইল: {$phone}\nপরিমাণ: <b>৳{$amount}</b> (" . strtoupper($method) . ")");

        echo json_encode(["success" => true, "message" => "উইথড্র রিকোয়েস্ট সফল হয়েছে! অ্যাডমিন যাচাই করে টাকা পাঠিয়ে দেবে।"]);
        break;

    // ১০. অ্যাডমিন: উইথড্র তালিকা
    case 'get_withdraws':
        $withdraws = readJson($withdrawsFile, []);
        echo json_encode(["success" => true, "withdraws" => $withdraws]);
        break;

    // ১১. অ্যাডমিন: উইথড্র স্ট্যাটাস আপডেট
    case 'update_withdraw':
        $id = $input['id'] ?? '';
        $newStatus = $input['status'] ?? 'paid';
        $withdraws = readJson($withdrawsFile, []);
        foreach ($withdraws as &$w) {
            if ($w['id'] === $id) {
                $w['status'] = $newStatus;
                break;
            }
        }
        writeJson($withdrawsFile, $withdraws);
        echo json_encode(["success" => true]);
        break;

    // ১২. অ্যাডমিন: ছবি মুছে ফেলা
    case 'approve_photo':
        $photoId = trim($input['id'] ?? '');
        $photos = readJson($photosFile, []);
        $found = false;
        foreach ($photos as &$p) {
            if ($p['id'] === $photoId) {
                $p['approved'] = true;
                $p['status'] = 'approved';
                $found = true;
                break;
            }
        }
        if ($found) {
            writeJson($photosFile, $photos);
            echo json_encode(["success" => true, "message" => "ছবি অনুমোদিত হয়েছে"]);
        } else {
            echo json_encode(["success" => false, "message" => "ছবি পাওয়া যায়নি"]);
        }
        break;

    case 'delete_photo':
        $id = $input['id'] ?? '';
        $photos = readJson($photosFile, []);
        $updated = [];
        foreach ($photos as $p) {
            if ($p['id'] === $id) {
                // ফাইল থাকলে মুছে ফেলা
                if (strpos($p['url'], 'uploads/') !== false && file_exists(__DIR__ . '/' . $p['url'])) {
                    @unlink(__DIR__ . '/' . $p['url']);
                }
            } else {
                $updated[] = $p;
            }
        }
        writeJson($photosFile, $updated);
        echo json_encode(["success" => true]);
        break;

    default:
        echo json_encode(["success" => true, "status" => "Photo Earn API is running"]);
        break;
}

