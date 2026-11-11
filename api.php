<?php
/**
 * ========================================================
 * 🚀 Photo Earn - Hardened PHP Backend Engine (api.php)
 * Server-Side Admin Session, Auth Hashing & Anti-Cheat API
 * ========================================================
 */

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['SERVER_PORT'] ?? 80) == 443)
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_set_cookie_params([
    'lifetime' => 86400,
    'path'     => '/',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

// Same-origin / CORS handling
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = $_SERVER['HTTP_HOST'] ?? '';
if ($origin && $host && parse_url($origin, PHP_URL_HOST) === explode(':', $host)[0]) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dataDir   = __DIR__ . '/data';
$uploadDir = __DIR__ . '/uploads';

if (!is_dir($dataDir)) @mkdir($dataDir, 0755, true);
if (!is_dir($uploadDir)) @mkdir($uploadDir, 0755, true);

$photosFile        = $dataDir . '/photos.json';
$usersFile         = $dataDir . '/users.json';
$withdrawsFile     = $dataDir . '/withdraws.json';
$statsFile         = $dataDir . '/stats.json';
$settingsFile      = $dataDir . '/settings.json';
$chatFile          = $dataDir . '/chat.json';
$notifsFile        = $dataDir . '/notifs.json';
$votesLogFile      = $dataDir . '/votes_log.json';
$likesLogFile      = $dataDir . '/likes_log.json';
$followersFile     = $dataDir . '/followers.json';
$adminAuthFile     = $dataDir . '/admin_auth.json';
$adminAttemptsFile = $dataDir . '/admin_attempts.json';
$loginAttemptsFile = $dataDir . '/login_attempts.json';

// প্রাথমিক অ্যাডমিন পিনের SHA-256 হ্যাশ (সোর্স কোডে প্লেইনটেক্সট পিন রাখা হয়নি)
define('PEG_INIT_PIN_HASH', '3db9f914c5ae28fee256bd211cbd48e6824b56fc3ebed4f5221637de6363912a');
define('PEG_TAKA_PER_POINT', 0.10);
define('PEG_MIN_WITHDRAW_TAKA', 50);
define('PEG_MIN_PHOTOS_WD', 3);

// ===== 🔔 টেলিগ্রাম অ্যালার্ট কনফিগ (ঐচ্ছিক) =====
$tgBotToken = "";
$tgChatId   = "";

function sendTelegramNotification($message) {
    global $tgBotToken, $tgChatId;
    if (empty($tgBotToken) || empty($tgChatId) || !function_exists('curl_init')) return;
    $url = "https://api.telegram.org/bot{$tgBotToken}/sendMessage";
    $ch = curl_init($url);
    if ($ch) {
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, ['chat_id' => $tgChatId, 'text' => $message, 'parse_mode' => 'HTML']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_exec($ch);
        curl_close($ch);
    }
}

function readJson($file, $default = []) {
    if (!file_exists($file)) return $default;
    $content = @file_get_contents($file);
    if ($content === false || $content === '') return $default;
    $data = json_decode($content, true);
    return is_array($data) ? $data : $default;
}

function writeJson($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function cleanText($str, $maxLen = 200) {
    $s = trim(strip_tags((string)$str));
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $maxLen, 'UTF-8');
    }
    return substr($s, 0, $maxLen);
}

function getClientIpHash() {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    return hash('sha256', 'peg_ip_salt_' . $ip);
}

function makeCreatorId($pin) {
    $clean = trim((string)$pin);
    if ($clean === '') return 'creator';
    return 'u_' . substr(hash('sha256', 'peg_pub_creator_' . $clean), 0, 12);
}

function sanitizePhoto($p, $isAdmin = false) {
    if (!is_array($p)) return $p;
    $authorPin = $p['authorPin'] ?? '';
    $p['authorId'] = !empty($p['authorId']) ? $p['authorId'] : ($authorPin !== '' ? makeCreatorId($authorPin) : 'creator');
    if (!$isAdmin) {
        unset($p['authorPin']);
    }
    return $p;
}

function isAdminLoggedIn() {
    return !empty($_SESSION['peg_admin_auth']) && $_SESSION['peg_admin_auth'] === true;
}

function requireAdmin() {
    if (!isAdminLoggedIn()) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "authRequired" => true,
            "message" => "অ্যাডমিন অনুমোদন প্রয়োজন! দয়া করে অ্যাডমিন পিন দিয়ে লগইন করুন।"
        ]);
        exit;
    }
}

function verifyAdminPin($pin) {
    global $adminAuthFile;
    $pin = trim((string)$pin);
    if ($pin === '') return false;
    if (file_exists($adminAuthFile)) {
        $auth = readJson($adminAuthFile, []);
        return !empty($auth['hash']) && password_verify($pin, $auth['hash']);
    }
    return hash_equals(PEG_INIT_PIN_HASH, hash('sha256', 'peg_init_salt_2026_' . $pin));
}

function addNotification(&$notifs, $pin, $title, $message, $type = 'info') {
    if (!$pin) return;
    if (!isset($notifs['personal']) || !is_array($notifs['personal'])) $notifs['personal'] = [];
    if (!isset($notifs['personal'][$pin]) || !is_array($notifs['personal'][$pin])) $notifs['personal'][$pin] = [];
    $item = [
        "id"      => "nt_" . round(microtime(true) * 1000) . "_" . rand(100, 999),
        "title"   => $title,
        "message" => $message,
        "type"    => $type,
        "ts"      => round(microtime(true) * 1000)
    ];
    array_unshift($notifs['personal'][$pin], $item);
    $notifs['personal'][$pin] = array_slice($notifs['personal'][$pin], 0, 30);
}

function creditUserInMap(&$users, $pin, $addPoints, $isReferral = false) {
    if (!$pin || !isset($users[$pin])) return null;
    $u = &$users[$pin];
    $basePts = isset($u['points']) ? intval($u['points']) : intval(round(floatval($u['taka'] ?? 0) / PEG_TAKA_PER_POINT));
    $u['points'] = max(0, $basePts + intval($addPoints));
    $u['taka']   = number_format($u['points'] * PEG_TAKA_PER_POINT, 2, '.', '');
    if ($isReferral) {
        $u['referralsCount'] = intval($u['referralsCount'] ?? 0) + 1;
    }
    return $u;
}

function fetchJsonUrl($url) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 200 && $code < 300 && $res) {
            return json_decode($res, true);
        }
        return null;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 12]]);
    $res = @file_get_contents($url, false, $ctx);
    return $res ? json_decode($res, true) : null;
}

function saveBase64Image($imgData, $photoId, $uploadDir) {
    if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,/i', $imgData, $m)) {
        return null;
    }
    $raw = substr($imgData, strpos($imgData, ',') + 1);
    $bin = base64_decode($raw, true);
    if ($bin === false || strlen($bin) < 100 || strlen($bin) > 5 * 1024 * 1024) {
        return null;
    }
    $info = @getimagesizefromstring($bin);
    if ($info === false || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        return null;
    }
    $ext = $info[2] === IMAGETYPE_PNG ? 'png' : ($info[2] === IMAGETYPE_WEBP ? 'webp' : 'jpg');
    $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '', $photoId);
    $fileName = $safeId . '.' . $ext;
    if (file_put_contents($uploadDir . '/' . $fileName, $bin, LOCK_EX) === false) {
        return null;
    }
    return 'uploads/' . $fileName;
}

// ডিফল্ট ছবি ইনিশিয়ালাইজেশন (ফাঁকা থাকলে)
if (!file_exists($photosFile)) {
    $defaultPhotos = [
        [
            "id" => "photo_1",
            "title" => "গ্রামের শান্ত বিকেল ও সূর্যাস্ত",
            "category" => "গ্রামের দৃশ্য",
            "authorName" => "তানভীর হাসান",
            "authorPin" => "1234",
            "authorId" => makeCreatorId("1234"),
            "photoType" => "FREE",
            "price" => 0,
            "views" => 342,
            "votes" => 68,
            "likes" => 25,
            "contestType" => "c24",
            "approved" => true,
            "status" => "approved",
            "url" => "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80",
            "date" => date('c', strtotime('-4 hours'))
        ],
        [
            "id" => "photo_2",
            "title" => "নদীর বুকে পালতোলা নৌকা",
            "category" => "নদী ও নৌকা",
            "authorName" => "রাকিবুল ইসলাম",
            "authorPin" => "2345",
            "authorId" => makeCreatorId("2345"),
            "photoType" => "FREE",
            "price" => 0,
            "views" => 654,
            "votes" => 112,
            "likes" => 40,
            "contestType" => "c7",
            "approved" => true,
            "status" => "approved",
            "url" => "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800&auto=format&fit=crop&q=80",
            "date" => date('c', strtotime('-20 hours'))
        ]
    ];
    writeJson($photosFile, $defaultPhotos);
}

$rawInput = file_get_contents('php://input');
$input    = json_decode($rawInput, true);
if (!is_array($input)) $input = [];
$action   = $_GET['action'] ?? ($input['action'] ?? '');
$ipHash   = getClientIpHash();

switch ($action) {

    // ===== ১. অ্যাডমিন অথেনটিকেশন (Session + Brute-force Limit) =====
    case 'admin_check':
        echo json_encode([
            "success" => true,
            "loggedIn" => isAdminLoggedIn(),
            "isDefaultPin" => !file_exists($adminAuthFile)
        ]);
        break;

    case 'admin_login':
        $attempts = readJson($adminAttemptsFile, []);
        $now = time();
        $rec = $attempts[$ipHash] ?? ["count" => 0, "lockedUntil" => 0];
        if (($rec['lockedUntil'] ?? 0) > $now) {
            $mins = ceil(($rec['lockedUntil'] - $now) / 60);
            http_response_code(429);
            echo json_encode(["success" => false, "message" => "অনেকবার ভুল পিন দেওয়া হয়েছে! অনুগ্রহ করে {$mins} মিনিট পর চেষ্টা করুন।"]);
            exit;
        }

        $pin = trim((string)($input['pin'] ?? ''));
        if (verifyAdminPin($pin)) {
            unset($attempts[$ipHash]);
            writeJson($adminAttemptsFile, $attempts);
            if (function_exists('session_regenerate_id')) @session_regenerate_id(true);
            $_SESSION['peg_admin_auth'] = true;
            echo json_encode([
                "success" => true,
                "isDefaultPin" => !file_exists($adminAuthFile)
            ]);
        } else {
            $rec['count'] = ($rec['count'] ?? 0) + 1;
            if ($rec['count'] >= 6) {
                $rec['lockedUntil'] = $now + 900; // ১৫ মিনিট লক
                $rec['count'] = 0;
            }
            $attempts[$ipHash] = $rec;
            writeJson($adminAttemptsFile, $attempts);
            http_response_code(401);
            echo json_encode(["success" => false, "message" => "ভুল অ্যাডমিন পিন! সঠিক পিন দিন।"]);
        }
        break;

    case 'admin_logout':
        $_SESSION['peg_admin_auth'] = false;
        session_destroy();
        echo json_encode(["success" => true]);
        break;

    case 'change_admin_pin':
        requireAdmin();
        $currPin = trim((string)($input['currentPin'] ?? ''));
        $newPin  = trim((string)($input['newPin'] ?? ''));
        if (!verifyAdminPin($currPin)) {
            echo json_encode(["success" => false, "message" => "বর্তমান পিনটি সঠিক নয়!"]);
            exit;
        }
        if (strlen($newPin) < 4 || strlen($newPin) > 32) {
            echo json_encode(["success" => false, "message" => "নতুন পিন কমপক্ষে ৪ অক্ষরের হতে হবে!"]);
            exit;
        }
        writeJson($adminAuthFile, [
            "hash" => password_hash($newPin, PASSWORD_DEFAULT),
            "updated" => date('c')
        ]);
        echo json_encode(["success" => true, "message" => "অ্যাডমিন পিন সফলভাবে পরিবর্তন হয়েছে!"]);
        break;

    // ===== ২. ভিজিটর ও সেটিংস =====
    case 'stats':
        $stats = readJson($statsFile, ["total" => 12450, "today" => 120, "lastDate" => date('Y-m-d')]);
        $today = date('Y-m-d');
        if (($stats['lastDate'] ?? '') !== $today) {
            $stats['lastDate'] = $today;
            $stats['today'] = 0;
        }
        $stats['total'] = intval($stats['total'] ?? 12450) + 1;
        $stats['today'] = intval($stats['today'] ?? 0) + 1;
        writeJson($statsFile, $stats);
        echo json_encode(["success" => true, "stats" => $stats]);
        break;

    case 'get_settings':
        $settings = readJson($settingsFile, ["auto_approve" => false]);
        echo json_encode(["success" => true, "auto_approve" => !empty($settings['auto_approve'])]);
        break;

    case 'set_auto_approve':
        requireAdmin();
        $enabled = !empty($input['enabled']);
        $settings = readJson($settingsFile, []);
        $settings['auto_approve'] = $enabled;
        writeJson($settingsFile, $settings);
        echo json_encode(["success" => true, "auto_approve" => $enabled]);
        break;

    // ===== ৩. ছবি গ্যালারি ও আপলোড =====
    case 'get_photos':
        $photos = readJson($photosFile, []);
        $isAdmin = isAdminLoggedIn() && (!empty($_GET['all']) || !empty($input['all']));
        $out = [];
        foreach ($photos as $p) {
            $approved = ($p['approved'] ?? true) !== false;
            if ($isAdmin || $approved) {
                $out[] = sanitizePhoto($p, $isAdmin);
            }
        }
        echo json_encode(["success" => true, "photos" => $out]);
        break;

    case 'upload_photo':
        $title       = cleanText($input['title'] ?? '', 120);
        $category    = cleanText($input['category'] ?? 'প্রকৃতি', 60);
        $contestType = in_array($input['contestType'] ?? '', ['c24', 'c7', 'c30'], true) ? $input['contestType'] : 'c24';
        $authorName  = cleanText($input['authorName'] ?? 'শিল্পী', 60);
        $authorPin   = cleanText($input['authorPin'] ?? '', 20);
        $photoType   = ($input['photoType'] ?? 'FREE') === 'PAID' ? 'PAID' : 'FREE';
        $price       = $photoType === 'PAID' ? max(5, min(5000, intval($input['price'] ?? 10))) : 0;
        $imgData     = (string)($input['image'] ?? '');

        if ($title === '' || $imgData === '') {
            echo json_encode(["success" => false, "message" => "ছবির শিরোনাম বা ডাটা পাওয়া যায়নি!"]);
            exit;
        }

        $photoId = "photo_" . round(microtime(true) * 1000) . "_" . rand(10, 99);
        $fileUrl = saveBase64Image($imgData, $photoId, $uploadDir);
        if ($fileUrl === null) {
            echo json_encode(["success" => false, "message" => "অবৈধ বা অতিরিক্ত বড় ছবি! দয়া করে JPG/PNG/WebP ছবি দিন।"]);
            exit;
        }

        // সার্ভার থেকেই auto_approve যাচাই (ক্লায়েন্ট approved পাঠিয়ে বাইপাস করতে পারবে না)
        $settings   = readJson($settingsFile, ["auto_approve" => false]);
        $isApproved = !empty($settings['auto_approve']);

        $newPhoto = [
            "id"          => $photoId,
            "title"       => $title,
            "category"    => $category,
            "contestType" => $contestType,
            "authorName"  => $authorName,
            "authorPin"   => $authorPin,
            "authorId"    => makeCreatorId($authorPin ?: $authorName),
            "photoType"   => $photoType,
            "price"       => $price,
            "url"         => $fileUrl,
            "views"       => 0,
            "votes"       => 0,
            "likes"       => 0,
            "approved"    => $isApproved,
            "status"      => $isApproved ? "approved" : "pending",
            "date"        => date('c')
        ];

        $photos = readJson($photosFile, []);
        array_unshift($photos, $newPhoto);
        writeJson($photosFile, $photos);

        if ($authorPin !== '') {
            $users = readJson($usersFile, []);
            if (isset($users[$authorPin])) {
                $users[$authorPin]['photosCount'] = intval($users[$authorPin]['photosCount'] ?? 0) + 1;
                writeJson($usersFile, $users);
            }
        }

        sendTelegramNotification("📷 <b>নতুন ছবি জমা পড়েছে!</b>\nশিরোনাম: {$title}\nশিল্পী: {$authorName}\nক্যাটাগরি: {$category}");

        echo json_encode(["success" => true, "photo" => sanitizePhoto($newPhoto, false)]);
        break;

    case 'vote':
        $photoId  = cleanText($input['photoId'] ?? '', 64);
        $voterPin = cleanText($input['voterPin'] ?? '', 20);
        if ($photoId === '') {
            echo json_encode(["success" => false, "message" => "ছবি আইডি নেই"]);
            exit;
        }

        $votesLog = readJson($votesLogFile, []);
        if (!empty($votesLog[$photoId][$ipHash])) {
            echo json_encode(["success" => false, "message" => "আপনি ইতিমধ্যে এই ছবিতে ভোট দিয়েছেন!"]);
            exit;
        }

        $photos   = readJson($photosFile, []);
        $found    = false;
        $newVotes = 0;

        foreach ($photos as &$p) {
            if (($p['id'] ?? '') === $photoId) {
                $p['votes'] = intval($p['votes'] ?? 0) + 1;
                $newVotes   = $p['votes'];
                $found      = true;

                if (!empty($p['authorPin'])) {
                    $users = readJson($usersFile, []);
                    if (creditUserInMap($users, $p['authorPin'], 2) !== null) {
                        writeJson($usersFile, $users);
                    }
                }
                break;
            }
        }
        unset($p);

        if (!$found) {
            echo json_encode(["success" => false, "message" => "ছবিটি খুঁজে পাওয়া যায়নি!"]);
            exit;
        }

        writeJson($photosFile, $photos);
        $votesLog[$photoId][$ipHash] = time();
        writeJson($votesLogFile, $votesLog);

        if ($voterPin !== '') {
            $users = readJson($usersFile, []);
            if (isset($users[$voterPin])) {
                $users[$voterPin]['likesGiven'] = intval($users[$voterPin]['likesGiven'] ?? 0) + 1;
                writeJson($usersFile, $users);
            }
        }

        echo json_encode(["success" => true, "votes" => $newVotes]);
        break;

    case 'like_photo':
        $photoId = cleanText($input['photoId'] ?? '', 64);
        $likesLog = readJson($likesLogFile, []);
        if ($photoId !== '' && !empty($likesLog[$photoId][$ipHash])) {
            echo json_encode(["success" => false, "message" => "আপনি ইতিমধ্যে এই ছবিতে লাইক দিয়েছেন!"]);
            exit;
        }
        $photos = readJson($photosFile, []);
        $found = false;
        $newLikes = 0;
        foreach ($photos as &$p) {
            if (($p['id'] ?? '') === $photoId) {
                $p['likes'] = intval($p['likes'] ?? 0) + 1;
                $newLikes = $p['likes'];
                $found = true;
                break;
            }
        }
        unset($p);
        if (!$found) {
            echo json_encode(["success" => false, "message" => "ছবি পাওয়া যায়নি!"]);
            exit;
        }
        writeJson($photosFile, $photos);
        $likesLog[$photoId][$ipHash] = time();
        writeJson($likesLogFile, $likesLog);
        echo json_encode(["success" => true, "likes" => $newLikes]);
        break;

    case 'view':
        $photoId = cleanText($input['photoId'] ?? '', 64);
        $photos  = readJson($photosFile, []);
        foreach ($photos as &$p) {
            if (($p['id'] ?? '') === $photoId) {
                $p['views'] = intval($p['views'] ?? 0) + 1;
                break;
            }
        }
        unset($p);
        writeJson($photosFile, $photos);
        echo json_encode(["success" => true]);
        break;

    case 'follow_creator':
        $creatorId = cleanText($input['creatorId'] ?? '', 64);
        $delta     = intval($input['delta'] ?? 1) >= 0 ? 1 : -1;
        if ($creatorId !== '') {
            $followers = readJson($followersFile, []);
            $followers[$creatorId] = max(0, intval($followers[$creatorId] ?? 0) + $delta);
            writeJson($followersFile, $followers);
        }
        echo json_encode(["success" => true]);
        break;

    // ===== ৪. ইউজার লগইন, রেজিস্ট্রেশন ও ইনকাম =====
    case 'login':
        $attempts = readJson($loginAttemptsFile, []);
        $now = time();
        $rec = $attempts[$ipHash] ?? ["count" => 0, "lockedUntil" => 0];
        if (($rec['lockedUntil'] ?? 0) > $now) {
            echo json_encode(["success" => false, "message" => "অনেকবার ভুল পিন দেওয়া হয়েছে! ১০ মিনিট পর চেষ্টা করুন।"]);
            exit;
        }

        $pin   = cleanText($input['pin'] ?? '', 20);
        $users = readJson($usersFile, []);
        if ($pin !== '' && isset($users[$pin])) {
            unset($attempts[$ipHash]);
            writeJson($loginAttemptsFile, $attempts);
            $u = $users[$pin];
            $u['creatorId'] = makeCreatorId($pin);
            echo json_encode(["success" => true, "user" => $u]);
        } else {
            $rec['count'] = ($rec['count'] ?? 0) + 1;
            if ($rec['count'] >= 20) {
                $rec['lockedUntil'] = $now + 600;
                $rec['count'] = 0;
            }
            $attempts[$ipHash] = $rec;
            writeJson($loginAttemptsFile, $attempts);
            echo json_encode(["success" => false, "message" => "ভুল পিন! একাউন্ট না থাকলে রেজিস্ট্রেশন করুন।"]);
        }
        break;

    case 'register':
        $pin   = cleanText($input['pin'] ?? '', 20);
        $name  = cleanText($input['name'] ?? '', 60);
        $phone = cleanText($input['phone'] ?? '', 20);
        $ref   = strtoupper(cleanText($input['ref'] ?? '', 30));

        if (strlen($pin) < 4 || $name === '' || $phone === '') {
            echo json_encode(["success" => false, "message" => "সঠিক তথ্য দিন! পিন কমপক্ষে ৪ সংখ্যার হতে হবে।"]);
            exit;
        }

        $users = readJson($usersFile, []);
        if (isset($users[$pin])) {
            echo json_encode(["success" => false, "message" => "এই পিন নম্বরটি ইতিমধ্যে ব্যবহৃত হয়েছে! অন্য পিন দিন বা লগইন করুন।"]);
            exit;
        }

        $newUser = [
            "pin"            => $pin,
            "creatorId"      => makeCreatorId($pin),
            "name"           => $name,
            "phone"          => $phone,
            "points"         => 20, // ওয়েলকাম বোনাস
            "taka"           => "2.00",
            "photosCount"    => 0,
            "referralsCount" => 0,
            "verified"       => false,
            "telegramBonus"  => false,
            "refCode"        => "REF" . $pin,
            "referredBy"     => $ref,
            "created"        => date('c')
        ];

        // রেফারেল বোনাস প্রদান (১০ পয়েন্ট = ৳১.০০)
        if ($ref !== '') {
            $refPin = (strpos($ref, 'REF') === 0) ? substr($ref, 3) : $ref;
            if ($refPin !== '' && $refPin !== $pin && isset($users[$refPin])) {
                if (creditUserInMap($users, $refPin, 10, true) !== null) {
                    $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
                    addNotification($notifs, $refPin, "🎁 নতুন রেফারেল বোনাস!", "আপনার রেফার লিংকে \"{$name}\" যোগ দিয়েছেন! আপনার ব্যালেন্সে +৳1.00 (10 পয়েন্ট) যোগ হয়েছে।", "ok");
                    writeJson($notifsFile, $notifs);
                }
            }
        }

        $users[$pin] = $newUser;
        writeJson($usersFile, $users);
        echo json_encode(["success" => true, "user" => $newUser]);
        break;

    case 'claim_telegram':
        $pin   = cleanText($input['pin'] ?? '', 20);
        $users = readJson($usersFile, []);
        if (!isset($users[$pin])) {
            echo json_encode(["success" => false, "message" => "প্রথমে একাউন্টে লগইন করুন!"]);
            exit;
        }
        if (!empty($users[$pin]['telegramBonus'])) {
            echo json_encode(["success" => false, "message" => "আপনি ইতিমধ্যে বোনাস পেয়েছেন!"]);
            exit;
        }
        $users[$pin]['telegramBonus'] = true;
        creditUserInMap($users, $pin, 100); // +100 পয়েন্ট = +৳10.00
        writeJson($usersFile, $users);
        $u = $users[$pin];
        $u['creatorId'] = makeCreatorId($pin);
        echo json_encode(["success" => true, "message" => "অভিনন্দন! ৳10 বোনাস একাউন্টে যোগ হয়েছে!", "user" => $u]);
        break;

    case 'withdraw':
        $pin    = cleanText($input['pin'] ?? '', 20);
        $phone  = cleanText($input['phone'] ?? '', 20);
        $amount = floatval($input['amount'] ?? 0);
        $method = in_array(strtolower(trim((string)($input['method'] ?? ''))), ['bkash', 'nagad', 'rocket', 'upay'], true)
            ? strtolower(trim((string)$input['method']))
            : 'bkash';

        $users = readJson($usersFile, []);
        if (!isset($users[$pin])) {
            echo json_encode(["success" => false, "message" => "ইউজার পাওয়া যায়নি!"]);
            exit;
        }

        $user = &$users[$pin];
        if ($amount < PEG_MIN_WITHDRAW_TAKA) {
            echo json_encode(["success" => false, "message" => "সর্বনিম্ন উইথড্র ৳" . PEG_MIN_WITHDRAW_TAKA . " হতে হবে!"]);
            exit;
        }
        if (floatval($user['taka'] ?? 0) < $amount) {
            echo json_encode(["success" => false, "message" => "আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই!"]);
            exit;
        }

        $photos = readJson($photosFile, []);
        $actualPhotos = 0;
        foreach ($photos as $p) {
            if (($p['authorPin'] ?? '') === $pin) $actualPhotos++;
        }
        $photoCount = max(intval($user['photosCount'] ?? 0), $actualPhotos);
        if ($photoCount < PEG_MIN_PHOTOS_WD) {
            echo json_encode(["success" => false, "message" => "টাকা তুলতে আপনার কমপক্ষে " . PEG_MIN_PHOTOS_WD . "টি ছবি আপলোড থাকতে হবে! বর্তমানে আছে {$photoCount}টি।"]);
            exit;
        }

        $deductPts = intval(round($amount / PEG_TAKA_PER_POINT));
        creditUserInMap($users, $pin, -$deductPts);
        writeJson($usersFile, $users);

        $withdraws = readJson($withdrawsFile, []);
        $newWd = [
            "id"     => "wd_" . round(microtime(true) * 1000) . "_" . rand(10, 99),
            "pin"    => $pin,
            "name"   => $user['name'],
            "phone"  => $phone,
            "amount" => $amount,
            "method" => $method,
            "status" => "pending",
            "date"   => date('c')
        ];
        array_unshift($withdraws, $newWd);
        writeJson($withdrawsFile, $withdraws);

        sendTelegramNotification("💳 <b>নতুন উইথড্র আবেদন!</b>\nনাম: {$user['name']}\nমোবাইল: {$phone}\nপরিমাণ: <b>৳{$amount}</b> (" . strtoupper($method) . ")");

        echo json_encode(["success" => true, "message" => "উইথড্র আবেদন সফল হয়েছে! অ্যাডমিন যাচাই করে বিকাশ/নগদে টাকা পাঠাবে।"]);
        break;

    // ===== ৫. পাবলিক লাইভ চ্যাট ও নোটিফিকেশন =====
    case 'get_chat':
        $chat = readJson($chatFile, []);
        $out  = [];
        foreach (array_slice($chat, -60) as $m) {
            $out[] = [
                "id"       => $m['id'] ?? '',
                "text"     => $m['text'] ?? '',
                "name"     => $m['name'] ?? 'অতিথি',
                "senderId" => $m['senderId'] ?? (!empty($m['pin']) ? makeCreatorId($m['pin']) : ''),
                "isAdmin"  => !empty($m['isAdmin']),
                "time"     => $m['time'] ?? ''
            ];
        }
        echo json_encode(["success" => true, "messages" => $out]);
        break;

    case 'send_chat':
        $text = cleanText($input['text'] ?? '', 500);
        if ($text === '') {
            echo json_encode(["success" => false, "message" => "বার্তা লিখুন"]);
            exit;
        }
        $isAdmin  = isAdminLoggedIn() && !empty($input['asAdmin']);
        $rawPin   = cleanText($input['pin'] ?? '', 20);
        $name     = $isAdmin ? "অ্যাডমিন (Admin)" : cleanText($input['name'] ?? 'অতিথি', 40);
        $senderId = $isAdmin ? "admin" : ($rawPin !== '' ? makeCreatorId($rawPin) : cleanText($input['guestId'] ?? $ipHash, 32));

        $newMsg = [
            "id"       => "msg_" . round(microtime(true) * 1000),
            "text"     => $text,
            "name"     => $name,
            "senderId" => $senderId,
            "isAdmin"  => $isAdmin,
            "time"     => date('c')
        ];
        $chat = readJson($chatFile, []);
        $chat[] = $newMsg;
        if (count($chat) > 60) $chat = array_slice($chat, -60);
        writeJson($chatFile, $chat);
        echo json_encode(["success" => true, "message" => $newMsg]);
        break;

    case 'get_notifications':
        $pin    = cleanText($input['pin'] ?? '', 20);
        $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
        $personal  = ($pin !== '' && !empty($notifs['personal'][$pin])) ? $notifs['personal'][$pin] : [];
        $broadcast = $notifs['broadcast'] ?? [];
        $all = array_merge($personal, $broadcast);
        usort($all, function($a, $b) {
            return ($b['ts'] ?? 0) <=> ($a['ts'] ?? 0);
        });
        echo json_encode(["success" => true, "notifications" => array_slice($all, 0, 35)]);
        break;

    // ===== ৬. কেবল অ্যাডমিন অ্যাকশনসমূহ (requireAdmin() বাধ্যতামূলক) =====
    case 'get_withdraws':
        requireAdmin();
        echo json_encode(["success" => true, "withdraws" => readJson($withdrawsFile, [])]);
        break;

    case 'update_withdraw':
        requireAdmin();
        $id        = cleanText($input['id'] ?? '', 64);
        $newStatus = ($input['status'] ?? '') === 'rejected' ? 'rejected' : 'paid';
        $withdraws = readJson($withdrawsFile, []);
        $target    = null;
        foreach ($withdraws as &$w) {
            if (($w['id'] ?? '') === $id) {
                $w['status'] = $newStatus;
                $target = $w;
                break;
            }
        }
        unset($w);
        writeJson($withdrawsFile, $withdraws);
        if ($target && !empty($target['pin'])) {
            $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
            addNotification(
                $notifs,
                $target['pin'],
                $newStatus === 'paid' ? "💸 পেমেন্ট সম্পন্ন হয়েছে!" : "⚠️ উইথড্র আবেদন বাতিল হয়েছে",
                $newStatus === 'paid'
                    ? "আপনার ৳{$target['amount']} উইথড্র আবেদন ({$target['method']}) সফলভাবে পরিশোধ করা হয়েছে।"
                    : "দুঃখিত, আপনার ৳{$target['amount']} উইথড্র আবেদনটি অ্যাডমিন বাতিল করেছেন।",
                $newStatus === 'paid' ? 'ok' : 'bad'
            );
            writeJson($notifsFile, $notifs);
        }
        echo json_encode(["success" => true]);
        break;

    case 'approve_photo':
        requireAdmin();
        $photoId = cleanText($input['id'] ?? '', 64);
        $photos  = readJson($photosFile, []);
        $found   = null;
        foreach ($photos as &$p) {
            if (($p['id'] ?? '') === $photoId) {
                $p['approved'] = true;
                $p['status']   = 'approved';
                $found = $p;
                break;
            }
        }
        unset($p);
        if (!$found) {
            echo json_encode(["success" => false, "message" => "ছবি পাওয়া যায়নি"]);
            exit;
        }
        writeJson($photosFile, $photos);
        if (!empty($found['authorPin'])) {
            $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
            addNotification($notifs, $found['authorPin'], "ছবি অনুমোদিত হয়েছে! 🎉", "অভিনন্দন! আপনার ছবি \"{$found['title']}\" অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং পাবলিক ফিডে লাইভ হয়েছে।", "ok");
            writeJson($notifsFile, $notifs);
        }
        echo json_encode(["success" => true, "photo" => sanitizePhoto($found, true)]);
        break;

    case 'reject_photo':
        requireAdmin();
        $photoId = cleanText($input['id'] ?? '', 64);
        $reason  = cleanText($input['reason'] ?? 'নীতিমালা পরিপন্থী বা অস্পষ্ট ছবি', 200);
        $photos  = readJson($photosFile, []);
        $updated = [];
        $target  = null;
        foreach ($photos as $p) {
            if (($p['id'] ?? '') === $photoId) {
                $target = $p;
                if (!empty($p['url']) && strpos($p['url'], 'uploads/') === 0 && file_exists(__DIR__ . '/' . $p['url'])) {
                    @unlink(__DIR__ . '/' . $p['url']);
                }
            } else {
                $updated[] = $p;
            }
        }
        writeJson($photosFile, $updated);
        if ($target && !empty($target['authorPin'])) {
            $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
            addNotification($notifs, $target['authorPin'], "ছবি অনুমোদন হয়নি", "দুঃখিত! আপনার ছবি \"{$target['title']}\" বাতিল করা হয়েছে। কারণ: {$reason}", "bad");
            writeJson($notifsFile, $notifs);
        }
        echo json_encode(["success" => true]);
        break;

    case 'delete_photo':
        requireAdmin();
        $id      = cleanText($input['id'] ?? '', 64);
        $photos  = readJson($photosFile, []);
        $updated = [];
        foreach ($photos as $p) {
            if (($p['id'] ?? '') === $id) {
                if (!empty($p['url']) && strpos($p['url'], 'uploads/') === 0 && file_exists(__DIR__ . '/' . $p['url'])) {
                    @unlink(__DIR__ . '/' . $p['url']);
                }
            } else {
                $updated[] = $p;
            }
        }
        writeJson($photosFile, $updated);
        echo json_encode(["success" => true]);
        break;

    case 'get_all_users':
        requireAdmin();
        $users = readJson($usersFile, []);
        $list  = array_values($users);
        usort($list, function($a, $b) {
            return floatval($b['taka'] ?? 0) <=> floatval($a['taka'] ?? 0);
        });
        echo json_encode(["success" => true, "users" => $list]);
        break;

    case 'adjust_user_balance':
        requireAdmin();
        $pin       = cleanText($input['pin'] ?? '', 20);
        $deltaTaka = floatval($input['deltaTaka'] ?? 0);
        $note      = cleanText($input['note'] ?? '', 160);
        $addPoints = intval(round($deltaTaka / PEG_TAKA_PER_POINT));
        if ($pin === '' || $addPoints === 0) {
            echo json_encode(["success" => false, "message" => "সঠিক পরিমাণ দিন!"]);
            exit;
        }
        $users = readJson($usersFile, []);
        $updated = creditUserInMap($users, $pin, $addPoints);
        if ($updated === null) {
            echo json_encode(["success" => false, "message" => "ইউজার পাওয়া যায়নি!"]);
            exit;
        }
        writeJson($usersFile, $users);

        $amtText    = number_format(abs($deltaTaka), 2, '.', '');
        $isPositive = $deltaTaka >= 0;
        $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
        addNotification(
            $notifs,
            $pin,
            $isPositive ? "🏆 অ্যাডমিন রিওয়ার্ড প্রাপ্তি!" : "💳 ব্যালেন্স সমন্বয়",
            $isPositive
                ? "অভিনন্দন! অ্যাডমিন আপনার অ্যাকাউন্টে +৳{$amtText} যোগ করেছেন।" . ($note ? " ({$note})" : "")
                : "অ্যাডমিন আপনার ব্যালেন্স থেকে ৳{$amtText} সমন্বয় করেছেন।" . ($note ? " ({$note})" : ""),
            $isPositive ? "ok" : "info"
        );
        writeJson($notifsFile, $notifs);

        echo json_encode(["success" => true, "user" => $updated]);
        break;

    case 'send_broadcast':
        requireAdmin();
        $title = cleanText($input['title'] ?? '📢 সাইট নোটিশ', 100);
        $msg   = cleanText($input['message'] ?? '', 500);
        if ($msg === '') {
            echo json_encode(["success" => false, "message" => "বিস্তারিত নোটিশ লিখুন"]);
            exit;
        }
        $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
        if (!isset($notifs['broadcast']) || !is_array($notifs['broadcast'])) $notifs['broadcast'] = [];
        $obj = [
            "id"      => "bc_" . round(microtime(true) * 1000),
            "title"   => $title,
            "message" => $msg,
            "type"    => "broadcast",
            "ts"      => round(microtime(true) * 1000)
        ];
        array_unshift($notifs['broadcast'], $obj);
        $notifs['broadcast'] = array_slice($notifs['broadcast'], 0, 30);
        writeJson($notifsFile, $notifs);
        echo json_encode(["success" => true, "notice" => $obj]);
        break;

    case 'delete_chat':
        requireAdmin();
        $id = cleanText($input['id'] ?? '', 64);
        $chat = readJson($chatFile, []);
        $chat = array_values(array_filter($chat, function($m) use ($id) {
            return ($m['id'] ?? '') !== $id;
        }));
        writeJson($chatFile, $chat);
        echo json_encode(["success" => true]);
        break;

    case 'clear_chat':
        requireAdmin();
        writeJson($chatFile, []);
        echo json_encode(["success" => true]);
        break;

    // এককালীন পুরনো Firebase ডাটা নিরাপদে Hostinger সার্ভারে ইমপোর্ট (Firebase বন্ধ করার আগে)
    case 'import_firebase':
        requireAdmin();
        $fbUrl = rtrim(trim((string)($input['firebaseUrl'] ?? '')), '/');
        if (!preg_match('#^https://[a-zA-Z0-9-]+\.firebaseio\.com$#', $fbUrl)) {
            echo json_encode(["success" => false, "message" => "সঠিক Firebase Database URL দিন (যেমন: https://your-app.firebaseio.com)"]);
            exit;
        }

        $imported = ["users" => 0, "photos" => 0, "withdraws" => 0];

        $fbUsers = fetchJsonUrl($fbUrl . '/users.json');
        if (is_array($fbUsers)) {
            $users = readJson($usersFile, []);
            foreach ($fbUsers as $k => $u) {
                if (!is_array($u) || empty($u['name'])) continue;
                $uPin = (string)($u['pin'] ?? $k);
                if (!isset($users[$uPin])) {
                    $u['pin'] = $uPin;
                    $u['creatorId'] = makeCreatorId($uPin);
                    $users[$uPin] = $u;
                    $imported['users']++;
                }
            }
            writeJson($usersFile, $users);
        }

        $fbPhotos = fetchJsonUrl($fbUrl . '/photos.json');
        if (is_array($fbPhotos)) {
            $photos = readJson($photosFile, []);
            $existingIds = [];
            foreach ($photos as $ep) $existingIds[$ep['id'] ?? ''] = true;

            foreach ($fbPhotos as $k => $p) {
                if (!is_array($p) || empty($p['title'])) continue;
                $pid = (string)($p['id'] ?? $k);
                if (isset($existingIds[$pid])) continue;
                $p['id'] = $pid;
                if (!empty($p['url']) && strpos($p['url'], 'data:image/') === 0) {
                    $savedUrl = saveBase64Image($p['url'], $pid, $uploadDir);
                    if ($savedUrl !== null) $p['url'] = $savedUrl;
                }
                if (!empty($p['authorPin'])) $p['authorId'] = makeCreatorId($p['authorPin']);
                $photos[] = $p;
                $existingIds[$pid] = true;
                $imported['photos']++;
            }
            writeJson($photosFile, $photos);
        }

        $fbWd = fetchJsonUrl($fbUrl . '/withdraws.json');
        if (is_array($fbWd)) {
            $withdraws = readJson($withdrawsFile, []);
            $existingW = [];
            foreach ($withdraws as $ew) $existingW[$ew['id'] ?? ''] = true;
            foreach ($fbWd as $k => $w) {
                if (!is_array($w)) continue;
                $wid = (string)($w['id'] ?? $k);
                if (isset($existingW[$wid])) continue;
                $w['id'] = $wid;
                $withdraws[] = $w;
                $imported['withdraws']++;
            }
            writeJson($withdrawsFile, $withdraws);
        }

        $fbStats = fetchJsonUrl($fbUrl . '/stats.json');
        if (is_array($fbStats) && !empty($fbStats['total'])) {
            $stats = readJson($statsFile, ["total" => 0, "today" => 0, "lastDate" => date('Y-m-d')]);
            if (intval($fbStats['total']) > intval($stats['total'] ?? 0)) {
                writeJson($statsFile, $fbStats);
            }
        }

        $fbSettings = fetchJsonUrl($fbUrl . '/settings.json');
        if (is_array($fbSettings) && array_key_exists('auto_approve', $fbSettings)) {
            $settings = readJson($settingsFile, []);
            $settings['auto_approve'] = !empty($fbSettings['auto_approve']);
            writeJson($settingsFile, $settings);
        }

        echo json_encode([
            "success"  => true,
            "imported" => $imported,
            "message"  => "ইমপোর্ট সম্পন্ন! ইউজার: {$imported['users']}টি, ছবি: {$imported['photos']}টি, উইথড্র: {$imported['withdraws']}টি Hostinger সার্ভারে সেভ হয়েছে।"
        ]);
        break;

    default:
        echo json_encode(["success" => true, "status" => "Photo Earn Secure API is running"]);
        break;
}
