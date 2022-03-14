<?php
ob_start();
$state = include('index.php');
$output = ob_get_contents(); // will hold the output of other.php
ob_end_clean();
file_put_contents('index.html', $output);

if(!$state)
{
    $to_print = $state;
    if($state === true)
        $to_print = 'true';
    if($state === false)
        $to_print = 'false';
    echo basename(__FILE__) . ': ';
    print_r($to_print);
}
?>